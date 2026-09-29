import { describe, expect, it } from 'vitest';
import { groupByType, summarizeDeck } from './deckSummary';
import { deckFrom, fixtureCards } from '../analysis/__fixtures__/load';

describe('summarizeDeck', () => {
  it('calcola colori, terre, curva e copertina', () => {
    const deck = deckFrom('4 Lightning Bolt\n4 Counterspell\n2 Murktide Regent\n4 Steam Vents\n6 Island');
    const s = summarizeDeck(deck, fixtureCards);
    expect(s.colors).toEqual(['U', 'R']);
    expect(s.lands).toBe(10);
    expect(s.mainCount).toBe(20);
    expect(s.curve[1]).toBe(4);
    expect(s.curve[2]).toBe(4);
    expect(s.curve[7]).toBe(2);
    expect(s.cover?.name).toBe('Counterspell');
  });
});

describe('summarizeDeck Commander', () => {
  it('usa il comandante per copertina, colori e conteggio', () => {
    const deck = { ...deckFrom('1 Sol Ring\n1 Lightning Bolt\n97 Mountain'), format: 'commander' as const, commanders: [{ name: 'Krenko, Mob Boss', quantity: 1 }] };
    const s = summarizeDeck(deck, fixtureCards);
    expect(s.cover?.name).toBe('Krenko, Mob Boss');
    expect(s.colors).toEqual(['R']);
    expect(s.mainCount).toBe(100);
    expect(s.commanders.map((c) => c.name)).toEqual(['Krenko, Mob Boss']);
  });
});

describe('groupByType', () => {
  it('raggruppa per tipo principale e ordina per costo', () => {
    const deck = deckFrom('4 Murktide Regent\n4 Counterspell\n4 Lightning Bolt\n2 Island\n1 Carta Inventata');
    const groups = groupByType(deck.main, fixtureCards);
    expect(groups.map((g) => [g.type, g.count])).toEqual([
      ['Creature', 4],
      ['Instant', 8],
      ['Land', 2],
      ['Other', 1],
    ]);
    expect(groups[1].entries.map((e) => e.name)).toEqual(['Lightning Bolt', 'Counterspell']);
  });
});
