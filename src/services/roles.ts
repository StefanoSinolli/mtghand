/**
 * Ruoli delle carte (tutor, sacrifice outlet, drain, ramp…) dalle etichette della community di
 * Scryfall (Tagger), interrogate con la ricerca `otag:`. Le etichette non arrivano con i dati
 * della carta: serve una ricerca per ruolo, limitata alle carte del mazzo. Risultati in cache.
 */

import { getMany, setMany } from 'idb-keyval';
import { fetchWithRetry, normalizeName, REQUEST_GAP, sleep } from './scryfall';

export type CardRole =
  | 'tutor'
  | 'sacOutlet'
  | 'drain'
  | 'ramp'
  | 'removal'
  | 'boardWipe'
  | 'counterspell'
  | 'cardAdvantage'
  | 'reanimate'
  | 'burn';

export const ROLES: Array<{ id: CardRole; tag: string; label: string }> = [
  { id: 'ramp', tag: 'ramp', label: 'Ramp' },
  { id: 'cardAdvantage', tag: 'card-advantage', label: 'Pescata' },
  { id: 'removal', tag: 'removal', label: 'Rimozione' },
  { id: 'boardWipe', tag: 'board-wipe', label: 'Board wipe' },
  { id: 'counterspell', tag: 'counterspell', label: 'Counterspell' },
  { id: 'tutor', tag: 'tutor', label: 'Tutor' },
  { id: 'reanimate', tag: 'reanimate', label: 'Reanimazione' },
  { id: 'sacOutlet', tag: 'sacrifice-outlet', label: 'Sacrifice outlet' },
  { id: 'drain', tag: 'life-drain', label: 'Drain' },
  { id: 'burn', tag: 'burn-player', label: 'Danno al giocatore' },
];

export const ROLE_LABELS = Object.fromEntries(ROLES.map((r) => [r.id, r.label])) as Record<CardRole, string>;

const SCRYFALL_SEARCH = 'https://api.scryfall.com/cards/search';
const CACHE_PREFIX = 'roles:';
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000;
const PARALLEL = 4;
/** Scryfall tronca le query oltre ~1000 caratteri ("unclosed parentheses"): restiamo sotto */
const MAX_QUERY_LENGTH = 950;
/** Spazio per "otag:<etichetta più lunga> (" */
const TAG_PREFIX_LENGTH = Math.max(...['sacrifice-outlet', 'card-advantage'].map((t) => `otag:${t} (`.length)) + 1;

interface CachedRoles {
  roles: CardRole[];
  expiry: number;
}

const memory = new Map<string, CachedRoles>();

/** Divide i nomi in gruppi la cui query `(!"A" or !"B" …)` non supera la lunghezza massima */
export const chunkNames = (names: string[]) => {
  const chunks: string[][] = [];
  let current: string[] = [];
  let length = TAG_PREFIX_LENGTH;
  for (const name of names) {
    const term = `!"${name.split(' // ')[0].replace(/"/g, '')}"`.length + 4; // più " or "
    if (current.length > 0 && length + term > MAX_QUERY_LENGTH) {
      chunks.push(current);
      current = [];
      length = TAG_PREFIX_LENGTH;
    }
    current.push(name);
    length += term;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
};

export const buildRoleQuery = (tag: string, names: string[]) =>
  `otag:${tag} (${names.map((n) => `!"${n.split(' // ')[0].replace(/"/g, '')}"`).join(' or ')})`;

interface SearchPage {
  data?: Array<{ name: string }>;
  has_more?: boolean;
  next_page?: string;
}

/** Nomi (normalizzati) delle carte della query che hanno l'etichetta */
const searchTagged = async (tag: string, names: string[]) => {
  const found = new Set<string>();
  let url: string | undefined = `${SCRYFALL_SEARCH}?unique=cards&q=${encodeURIComponent(buildRoleQuery(tag, names))}`;
  while (url) {
    const response = await fetchWithRetry(url);
    if (response.status === 404) break; // nessuna carta con questa etichetta
    if (!response.ok) throw new Error(`Ricerca Scryfall non valida (${response.status})`);
    const page = (await response.json()) as SearchPage;
    // solo il nome frontale: "Emeritus of Woe // Demonic Tutor" non deve passare per Demonic Tutor
    for (const card of page.data ?? []) found.add(normalizeName(card.name));
    url = page.has_more ? page.next_page : undefined;
    if (url) await sleep(REQUEST_GAP);
  }
  return found;
};

/**
 * Ruoli delle carte indicate (chiave: nome normalizzato). Le carte senza etichette
 * hanno una lista vuota; le carte già in cache non vengono richieste.
 */
const inFlight = new Map<string, Promise<Map<string, CardRole[]>>>();

/** Come loadRoles, ma due richieste uguali in contemporanea ne fanno una sola */
export const fetchRoles = (names: string[]): Promise<Map<string, CardRole[]>> => {
  const key = [...new Set(names.map(normalizeName))].sort().join('\n');
  const pending = inFlight.get(key);
  if (pending) return pending;
  const promise = loadRoles(names).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
};

const loadRoles = async (names: string[]): Promise<Map<string, CardRole[]>> => {
  const keys = [...new Set(names.map(normalizeName))];
  const byKey = new Map(names.map((n) => [normalizeName(n), n]));
  const result = new Map<string, CardRole[]>();
  const now = Date.now();

  let missing = keys.filter((k) => {
    const cached = memory.get(k);
    if (cached && cached.expiry > now) result.set(k, cached.roles);
    return !result.has(k);
  });

  if (missing.length > 0) {
    try {
      const stored = await getMany<CachedRoles | undefined>(missing.map((k) => CACHE_PREFIX + k));
      stored.forEach((entry, i) => {
        if (entry && entry.expiry > now) {
          memory.set(missing[i], entry);
          result.set(missing[i], entry.roles);
        }
      });
      missing = missing.filter((k) => !result.has(k));
    } catch {
      // IndexedDB non disponibile: solo cache in memoria
    }
  }
  if (missing.length === 0) return result;

  const roles = new Map<string, CardRole[]>(missing.map((k) => [k, []]));
  const chunks = chunkNames(missing.map((k) => byKey.get(k)!));
  const tasks = ROLES.flatMap((role) => chunks.map((chunk) => ({ role, chunk })));
  const found = new Map<CardRole, Set<string>>(ROLES.map((r) => [r.id, new Set()]));

  // Fino a PARALLEL ricerche insieme, ognuna seguita da una pausa: resta sotto ~10 richieste/secondo
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const { role, chunk } = tasks[next++];
      for (const key of await searchTagged(role.tag, chunk)) found.get(role.id)!.add(key);
      await sleep(REQUEST_GAP * PARALLEL);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, tasks.length) }, worker));

  // ruoli nell'ordine di ROLES
  for (const role of ROLES) {
    for (const key of missing) {
      if (found.get(role.id)!.has(key)) roles.get(key)!.push(role.id);
    }
  }

  const expiry = Date.now() + CACHE_EXPIRY;
  const entries: [string, CachedRoles][] = [];
  for (const [key, list] of roles) {
    memory.set(key, { roles: list, expiry });
    entries.push([CACHE_PREFIX + key, { roles: list, expiry }]);
    result.set(key, list);
  }
  try {
    await setMany(entries);
  } catch {
    // vedi sopra
  }
  return result;
};
