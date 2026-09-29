/**
 * Mano iniziale con London Mulligan:
 * 1. peschi 7 carte
 * 2. Mulligan → rimescoli tutto e ripeschi 7 (mulligans + 1)
 * 3. Keep → se hai fatto N mulligan scegli N carte da mettere in fondo al mazzo
 */

import type { CardInstance, DeckEntry } from '../types';
import { expandEntries } from '../utils/deckParser';
import { shuffle } from '../utils/shuffle';

export const HAND_SIZE = 7;
/** Oltre questo numero di mulligan resterebbe una mano vuota */
export const MAX_MULLIGANS = HAND_SIZE - 1;

export type HandPhase = 'deciding' | 'bottoming' | 'kept';

export interface HandState {
  phase: HandPhase;
  hand: CardInstance[];
  library: CardInstance[];
  mulligans: number;
  /** uid delle carte scelte per il fondo (solo in fase 'bottoming') */
  selected: string[];
}

type Random = () => number;

const toInstances = (entries: DeckEntry[]): CardInstance[] =>
  expandEntries(entries).map((name, i) => ({ uid: `${i}-${name}`, name }));

const draw = (cards: CardInstance[], random: Random, mulligans: number): HandState => {
  const shuffled = shuffle(cards, random);
  return {
    phase: 'deciding',
    hand: shuffled.slice(0, HAND_SIZE),
    library: shuffled.slice(HAND_SIZE),
    mulligans,
    selected: [],
  };
};

export const newGame = (main: DeckEntry[], random: Random = Math.random): HandState =>
  draw(toInstances(main), random, 0);

export const canMulligan = (state: HandState) =>
  state.phase === 'deciding' && state.mulligans < MAX_MULLIGANS;

export const mulligan = (state: HandState, random: Random = Math.random): HandState => {
  if (!canMulligan(state)) return state;
  return draw([...state.hand, ...state.library], random, state.mulligans + 1);
};

export const keep = (state: HandState): HandState => {
  if (state.phase !== 'deciding') return state;
  return { ...state, phase: state.mulligans > 0 ? 'bottoming' : 'kept', selected: [] };
};

export const toggleBottom = (state: HandState, uid: string): HandState => {
  if (state.phase !== 'bottoming') return state;

  if (state.selected.includes(uid)) {
    return { ...state, selected: state.selected.filter((id) => id !== uid) };
  }
  if (state.selected.length >= state.mulligans) return state;
  return { ...state, selected: [...state.selected, uid] };
};

export const confirmBottom = (state: HandState): HandState => {
  if (state.phase !== 'bottoming' || state.selected.length !== state.mulligans) return state;

  // Le carte vanno in fondo nell'ordine in cui sono state scelte
  const bottom = state.selected.map((uid) => state.hand.find((c) => c.uid === uid)!);
  return {
    ...state,
    phase: 'kept',
    hand: state.hand.filter((c) => !state.selected.includes(c.uid)),
    library: [...state.library, ...bottom],
    selected: [],
  };
};
