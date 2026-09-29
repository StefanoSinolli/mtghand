import { describe, expect, it } from 'vitest';
import { addCopies, moveEntry, removeEntry, setQuantity } from './deckEdit';

describe('deckEdit', () => {
  const list = [{ name: 'Opt', quantity: 2 }];

  it('aggiunge copie a una carta esistente o nuova', () => {
    expect(addCopies(list, 'opt')).toEqual([{ name: 'Opt', quantity: 3 }]);
    expect(addCopies(list, 'Island', 4)).toEqual([...list, { name: 'Island', quantity: 4 }]);
  });

  it('imposta la quantità e rimuove a zero', () => {
    expect(setQuantity(list, 'Opt', 4)).toEqual([{ name: 'Opt', quantity: 4 }]);
    expect(setQuantity(list, 'Opt', 0)).toEqual([]);
    expect(removeEntry(list, 'Opt')).toEqual([]);
  });

  it('sposta una carta tra main e sideboard', () => {
    const [main, side] = moveEntry(list, [{ name: 'Opt', quantity: 1 }], 'Opt');
    expect(main).toEqual([]);
    expect(side).toEqual([{ name: 'Opt', quantity: 3 }]);
  });
});
