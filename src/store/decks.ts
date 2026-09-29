/**
 * Store dei mazzi: legge/scrive tramite deckStorage e notifica i componenti React
 */

import { useSyncExternalStore } from 'react';
import { createDeck, deleteDeck as removeDeck, getDecks, saveDeck as persistDeck } from '../services/deckStorage';
import { parseDeckList } from '../utils/deckParser';
import type { Deck } from '../types';

const DEFAULT_TEST_DECK = `4 Lightning Bolt
4 Monastery Swiftspear
4 Eidolon of the Great Revel
4 Goblin Guide
4 Lava Spike
4 Rift Bolt
4 Skewer the Critics
2 Light Up the Stage
2 Searing Blood
2 Roiling Vortex
20 Mountain
4 Sunbaked Canyon
2 Den of the Bugbear

Sideboard
4 Smash to Smithereens
3 Pyroblast
3 Tormod's Crypt
2 Skullcrack
3 Path to Exile`;

const listeners = new Set<() => void>();
let snapshot: Deck[] | null = null;

const load = (): Deck[] => {
  let decks = getDecks();

  // Primo avvio: carica un mazzo di prova
  if (decks.length === 0 && localStorage.getItem('mtg_decks') === null) {
    const parsed = parseDeckList(DEFAULT_TEST_DECK);
    const testDeck: Deck = {
      ...createDeck('Mono Red Burn (Test)', parsed.main, parsed.side),
      id: 'test-deck',
      isTestDeck: true,
    };
    persistDeck(testDeck);
    decks = [testDeck];
  }

  return decks;
};

const emit = () => {
  snapshot = getDecks();
  listeners.forEach((l) => l());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => {
  if (snapshot === null) snapshot = load();
  return snapshot;
};

export const useDecks = () => useSyncExternalStore(subscribe, getSnapshot);

export const useDeck = (id: string | undefined) => useDecks().find((d) => d.id === id);

export const saveDeck = (deck: Deck) => {
  persistDeck({ ...deck, updatedAt: new Date().toISOString() });
  emit();
};

export const deleteDeck = (id: string) => {
  removeDeck(id);
  emit();
};

// Sincronizza tra schede del browser
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'mtg_decks') emit();
  });
}
