import type { Deck } from '../types';
import type { BasicChange } from './optimizer';

/** Applica le modifiche alle terre base proposte dall'optimizer al main deck */
export const applyBasicChanges = (deck: Deck, changes: BasicChange[]): Deck => {
  let main = [...deck.main];

  for (const change of changes) {
    const index = main.findIndex((e) => e.name.toLowerCase() === change.name.toLowerCase());
    if (change.to === 0) {
      main = main.filter((_, i) => i !== index);
    } else if (index >= 0) {
      main[index] = { ...main[index], quantity: change.to };
    } else {
      main.push({ name: change.name, quantity: change.to });
    }
  }

  return { ...deck, main, updatedAt: new Date().toISOString() };
};
