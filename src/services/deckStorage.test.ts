import { describe, expect, it } from 'vitest';
import { migrateDeck } from './deckStorage';
import type { Deck } from '../types';

describe('migrateDeck', () => {
  it('converte i mazzi importati v1 (array di stringhe)', () => {
    const deck = migrateDeck({
      id: '1',
      name: 'Burn',
      mainDeck: ['Lightning Bolt', 'Lightning Bolt', 'Mountain'],
      sideboard: ['Pyroblast'],
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    expect(deck).toMatchObject({
      schemaVersion: 2,
      format: 'constructed60',
      main: [
        { name: 'Lightning Bolt', quantity: 2 },
        { name: 'Mountain', quantity: 1 },
      ],
      side: [{ name: 'Pyroblast', quantity: 1 }],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    });
  });

  it('converte i mazzi del builder v1 ({name, quantity})', () => {
    const deck = migrateDeck({
      id: '2',
      name: 'Built',
      mainDeck: [{ name: 'Opt', quantity: 4 }, { name: 'Opt', quantity: 2 }],
      sideboard: [],
    });
    expect(deck.main).toEqual([{ name: 'Opt', quantity: 6 }]);
  });

  it('converte il formato più vecchio con `cards`', () => {
    const deck = migrateDeck({ id: '3', name: 'Old', cards: ['Island', 'Island'] });
    expect(deck.main).toEqual([{ name: 'Island', quantity: 2 }]);
    expect(deck.side).toEqual([]);
  });

  it('lascia invariati i mazzi v2', () => {
    const v2: Deck = {
      id: '4',
      name: 'New',
      format: 'constructed60',
      main: [{ name: 'Island', quantity: 20 }],
      side: [],
      schemaVersion: 2,
      createdAt: 'x',
      updatedAt: 'y',
    };
    expect(migrateDeck(v2)).toBe(v2);
  });
});
