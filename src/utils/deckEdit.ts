/**
 * Operazioni immutabili su liste di DeckEntry (editor)
 */

import type { DeckEntry } from '../types';

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export const addCopies = (list: DeckEntry[], name: string, copies = 1): DeckEntry[] => {
  const existing = list.find((e) => same(e.name, name));
  if (!existing) return copies > 0 ? [...list, { name, quantity: copies }] : list;
  return setQuantity(list, name, existing.quantity + copies);
};

export const setQuantity = (list: DeckEntry[], name: string, quantity: number): DeckEntry[] =>
  quantity <= 0
    ? list.filter((e) => !same(e.name, name))
    : list.map((e) => (same(e.name, name) ? { ...e, quantity } : e));

export const removeEntry = (list: DeckEntry[], name: string) => list.filter((e) => !same(e.name, name));

/** Sposta tutte le copie di una carta da una lista all'altra */
export const moveEntry = (from: DeckEntry[], to: DeckEntry[], name: string): [DeckEntry[], DeckEntry[]] => {
  const entry = from.find((e) => same(e.name, name));
  if (!entry) return [from, to];
  return [removeEntry(from, name), addCopies(to, entry.name, entry.quantity)];
};
