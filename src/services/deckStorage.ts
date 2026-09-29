/**
 * Gestione salvataggio mazzi in LocalStorage
 * In futuro questo file sarà modificato per usare Firebase
 */

import type { Deck, DeckEntry, DeckFormat } from '../types';

const STORAGE_KEY = 'mtg_decks';

/** Voce di mazzo nei formati v1: stringa singola (una copia) o {name, quantity} (builder) */
type LegacyCard = string | { name: string; quantity?: number };

interface LegacyDeck {
  id: string;
  name: string;
  cards?: LegacyCard[];
  mainDeck?: LegacyCard[];
  sideboard?: LegacyCard[];
  createdAt?: string;
  isTestDeck?: boolean;
}

const toEntries = (cards: LegacyCard[] = []): DeckEntry[] => {
  const entries: DeckEntry[] = [];
  for (const card of cards) {
    const name = typeof card === 'string' ? card : card.name;
    const quantity = typeof card === 'string' ? 1 : (card.quantity ?? 1);
    const existing = entries.find((e) => e.name === name);
    if (existing) {
      existing.quantity += quantity;
    } else {
      entries.push({ name, quantity });
    }
  }
  return entries;
};

/** Converte qualsiasi versione salvata nel formato v2 */
export const migrateDeck = (raw: Deck | LegacyDeck): Deck => {
  if ('schemaVersion' in raw && raw.schemaVersion === 2) return raw;

  const legacy = raw as LegacyDeck;
  const createdAt = legacy.createdAt ?? new Date().toISOString();

  return {
    id: legacy.id,
    name: legacy.name,
    format: 'constructed60',
    main: toEntries(legacy.mainDeck ?? legacy.cards),
    side: toEntries(legacy.sideboard),
    schemaVersion: 2,
    createdAt,
    updatedAt: createdAt,
    ...(legacy.isTestDeck ? { isTestDeck: true } : {}),
  };
};

export const saveDecks = (decks: Deck[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
};

export const getDecks = (): Deck[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored) as Array<Deck | LegacyDeck>;
    return parsed.map(migrateDeck);
  } catch (error) {
    console.error('Mazzi salvati non leggibili', error);
    return [];
  }
};

export const saveDeck = (deck: Deck) => {
  const decks = getDecks();
  const existingIndex = decks.findIndex((d) => d.id === deck.id);

  if (existingIndex >= 0) {
    decks[existingIndex] = deck;
  } else {
    decks.push(deck);
  }

  saveDecks(decks);
};

export const deleteDeck = (deckId: string) => {
  saveDecks(getDecks().filter((d) => d.id !== deckId));
};

export const getDeck = (deckId: string) => getDecks().find((d) => d.id === deckId);

export const createDeck = (
  name: string,
  main: DeckEntry[],
  side: DeckEntry[] = [],
  format: DeckFormat = 'constructed60',
  commanders: DeckEntry[] = [],
): Deck => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    format,
    main,
    side,
    ...(format === 'commander' ? { commanders } : {}),
    schemaVersion: 2,
    createdAt: now,
    updatedAt: now,
  };
};
