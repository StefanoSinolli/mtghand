import { describe, expect, it } from 'vitest';
import { applyBasicChanges } from './applyProposal';
import { deckFrom } from './__fixtures__/load';

describe('applyBasicChanges', () => {
  it('rimuove, aggiorna e aggiunge le base', () => {
    const deck = deckFrom('4 Lightning Bolt\n19 Mountain\n1 Island');
    const updated = applyBasicChanges(deck, [
      { name: 'Island', from: 1, to: 0 },
      { name: 'Mountain', from: 19, to: 18 },
      { name: 'Plains', from: 0, to: 2 },
    ]);
    expect(updated.main).toEqual([
      { name: 'Lightning Bolt', quantity: 4 },
      { name: 'Mountain', quantity: 18 },
      { name: 'Plains', quantity: 2 },
    ]);
    expect(deck.main).toHaveLength(3); // l'originale non cambia
  });
});
