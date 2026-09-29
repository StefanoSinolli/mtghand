/**
 * Servizio per interagire con le API di Scryfall
 * Documentazione: https://scryfall.com/docs/api
 */

import { getMany, setMany } from 'idb-keyval';
import type { DisplayCard, ScryfallCard, ScryfallImageUris } from '../types';

const SCRYFALL_API = 'https://api.scryfall.com';
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 giorni
const CACHE_PREFIX = 'card:';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms
const REQUEST_GAP = 100; // Scryfall chiede ~10 richieste/secondo al massimo
const COLLECTION_CHUNK = 75; // limite di identifiers per /cards/collection

interface CachedCard {
  data: ScryfallCard;
  expiry: number;
}

const memoryCache = new Map<string, CachedCard>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Nome normalizzato per il confronto: faccia frontale, minuscolo, senza accenti.
 * "Fable of the Mirror-Breaker // Reflection of Kiki-Jiki" → "fable of the mirror-breaker"
 */
export const normalizeName = (name: string) =>
  name
    .split(' // ')[0]
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  retries = MAX_RETRIES,
): Promise<Response> => {
  try {
    const response = await fetch(url, options);

    if (response.status === 429) {
      if (retries > 0) {
        await sleep(RETRY_DELAY * (MAX_RETRIES - retries + 1));
        return fetchWithRetry(url, options, retries - 1);
      }
      throw new Error('Rate limit raggiunto');
    }

    // 404 è una risposta valida (carta non trovata): niente retry
    if (!response.ok && response.status !== 404) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response;
  } catch (error) {
    if (retries > 0) {
      console.warn(`Retry ${MAX_RETRIES - retries + 1}/${MAX_RETRIES} per ${url}`);
      await sleep(RETRY_DELAY);
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
};

// --- Cache (memoria + IndexedDB) ---------------------------------------------

const cardKeys = (card: ScryfallCard) => {
  const keys = new Set([normalizeName(card.name)]);
  for (const face of card.card_faces ?? []) keys.add(normalizeName(face.name));
  return [...keys];
};

const readCache = async (keys: string[]) => {
  const found = new Map<string, ScryfallCard>();
  const now = Date.now();
  const toLookup: string[] = [];

  for (const key of keys) {
    const cached = memoryCache.get(key);
    if (cached && cached.expiry > now) {
      found.set(key, cached.data);
    } else {
      toLookup.push(key);
    }
  }

  if (toLookup.length > 0) {
    try {
      const stored = await getMany<CachedCard | undefined>(toLookup.map((k) => CACHE_PREFIX + k));
      stored.forEach((entry, i) => {
        if (entry && entry.expiry > now) {
          memoryCache.set(toLookup[i], entry);
          found.set(toLookup[i], entry.data);
        }
      });
    } catch {
      // IndexedDB non disponibile (navigazione privata, test): solo cache in memoria
    }
  }

  return found;
};

const writeCache = async (cards: ScryfallCard[]) => {
  const expiry = Date.now() + CACHE_EXPIRY;
  const entries: [string, CachedCard][] = [];

  for (const card of cards) {
    for (const key of cardKeys(card)) {
      const cached = { data: card, expiry };
      memoryCache.set(key, cached);
      entries.push([CACHE_PREFIX + key, cached]);
    }
  }

  try {
    await setMany(entries);
  } catch {
    // vedi readCache
  }
};

// --- API pubblica ------------------------------------------------------------

/**
 * Cerca una carta per nome (fuzzy, tollera errori di battitura)
 */
export const searchCardByName = async (cardName: string): Promise<ScryfallCard | null> => {
  const key = normalizeName(cardName);
  const cached = (await readCache([key])).get(key);
  if (cached) return cached;

  try {
    const response = await fetchWithRetry(
      `${SCRYFALL_API}/cards/named?fuzzy=${encodeURIComponent(cardName)}`,
    );
    if (!response.ok) return null;

    const card = (await response.json()) as ScryfallCard;
    await writeCache([card]);
    return card;
  } catch (error) {
    console.warn(`Carta non trovata: ${cardName}`, error);
    return null;
  }
};

/**
 * Suggerimenti di nomi per la ricerca (max 20)
 */
export const autocompleteCardNames = async (query: string, signal?: AbortSignal): Promise<string[]> => {
  if (query.trim().length < 2) return [];
  const response = await fetch(`${SCRYFALL_API}/cards/autocomplete?q=${encodeURIComponent(query)}`, { signal });
  if (!response.ok) return [];
  const data = (await response.json()) as { data: string[] };
  return data.data;
};

export interface FetchCardsResult {
  /** Indicizzate per nome normalizzato (vedi normalizeName) */
  cards: Map<string, ScryfallCard>;
  /** Nomi richiesti che Scryfall non ha riconosciuto */
  missing: string[];
}

/**
 * Carica i dati di più carte: prima dalla cache, poi da /cards/collection.
 * I nomi non trovati vengono ritentati con la ricerca fuzzy.
 */
export const fetchCards = async (names: string[]): Promise<FetchCardsResult> => {
  const byKey = new Map<string, string>(); // chiave normalizzata → nome originale
  for (const name of names) byKey.set(normalizeName(name), name);

  const cards = await readCache([...byKey.keys()]);
  const toFetch = [...byKey.keys()].filter((key) => !cards.has(key));
  const notFound: string[] = [];

  for (let i = 0; i < toFetch.length; i += COLLECTION_CHUNK) {
    if (i > 0) await sleep(REQUEST_GAP);

    const chunk = toFetch.slice(i, i + COLLECTION_CHUNK);
    const response = await fetchWithRetry(`${SCRYFALL_API}/cards/collection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifiers: chunk.map((key) => ({ name: byKey.get(key)!.split(' // ')[0] })),
      }),
    });

    const data = (await response.json()) as {
      data: ScryfallCard[];
      not_found?: Array<{ name: string }>;
    };

    await writeCache(data.data);
    for (const card of data.data) {
      for (const key of cardKeys(card)) cards.set(key, card);
    }
    for (const missing of data.not_found ?? []) notFound.push(missing.name);
  }

  // Secondo tentativo con fuzzy per i nomi scritti male
  const missing: string[] = [];
  for (const name of notFound) {
    await sleep(REQUEST_GAP);
    const card = await searchCardByName(name);
    if (card) {
      cards.set(normalizeName(name), card);
    } else {
      missing.push(byKey.get(normalizeName(name)) ?? name);
    }
  }

  return { cards, missing };
};

/** Recupera i dati di una carta dalla mappa, o un placeholder se manca */
export const lookupCard = (cards: Map<string, ScryfallCard>, name: string): DisplayCard =>
  cards.get(normalizeName(name)) ?? { name, placeholder: true };

/**
 * Immagine della carta (small, normal, large, art_crop, …) con fallback sulla faccia frontale
 */
export const getCardImage = (
  card: DisplayCard | null | undefined,
  size: keyof ScryfallImageUris = 'normal',
): string | null => {
  if (!card || 'placeholder' in card) return null;

  return (
    card.image_uris?.[size] ??
    card.card_faces?.[0]?.image_uris?.[size] ??
    card.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.normal ??
    null
  );
};
