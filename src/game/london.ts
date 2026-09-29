/**
 * Mano iniziale con London Mulligan:
 * 1. peschi 7 carte
 * 2. Mulligan → rimescoli tutto e ripeschi 7 (mulligans + 1)
 * 3. Keep → se hai fatto N mulligan scegli N carte da mettere in fondo al mazzo
 * Nel Commander multiplayer il primo mulligan è gratuito: N − 1 carte in fondo.
 */

import type { CardInstance, DeckEntry } from '../types';
import { expandEntries } from '../utils/deckParser';
import { shuffle } from '../utils/shuffle';

export const HAND_SIZE = 7;
/** Oltre questo numero di carte in fondo resterebbe una mano vuota */
export const MAX_BOTTOM = HAND_SIZE - 1;

export type HandPhase = 'deciding' | 'bottoming' | 'kept';

export interface HandState {
  phase: HandPhase;
  hand: CardInstance[];
  library: CardInstance[];
  mulligans: number;
  /** Il primo mulligan non fa mettere carte in fondo (Commander) */
  freeMulligan: boolean;
  /** uid delle carte scelte per il fondo (solo in fase 'bottoming') */
  selected: string[];
}

export interface GameOptions {
  freeFirstMulligan?: boolean;
}

type Random = () => number;

const toInstances = (entries: DeckEntry[]): CardInstance[] =>
  expandEntries(entries).map((name, i) => ({ uid: `${i}-${name}`, name }));

const draw = (cards: CardInstance[], random: Random, mulligans: number, freeMulligan: boolean): HandState => {
  const shuffled = shuffle(cards, random);
  return {
    phase: 'deciding',
    hand: shuffled.slice(0, HAND_SIZE),
    library: shuffled.slice(HAND_SIZE),
    mulligans,
    freeMulligan,
    selected: [],
  };
};

export const newGame = (main: DeckEntry[], options: GameOptions = {}, random: Random = Math.random): HandState =>
  draw(toInstances(main), random, 0, options.freeFirstMulligan ?? false);

/** Carte da mettere in fondo al keep */
export const cardsToBottom = (state: Pick<HandState, 'mulligans' | 'freeMulligan'>) =>
  Math.max(0, state.mulligans - (state.freeMulligan ? 1 : 0));

export const canMulligan = (state: HandState) =>
  state.phase === 'deciding' && cardsToBottom({ ...state, mulligans: state.mulligans + 1 }) <= MAX_BOTTOM;

export const mulligan = (state: HandState, random: Random = Math.random): HandState => {
  if (!canMulligan(state)) return state;
  return draw([...state.hand, ...state.library], random, state.mulligans + 1, state.freeMulligan);
};

export const keep = (state: HandState): HandState => {
  if (state.phase !== 'deciding') return state;
  return { ...state, phase: cardsToBottom(state) > 0 ? 'bottoming' : 'kept', selected: [] };
};

export const toggleBottom = (state: HandState, uid: string): HandState => {
  if (state.phase !== 'bottoming') return state;

  if (state.selected.includes(uid)) {
    return { ...state, selected: state.selected.filter((id) => id !== uid) };
  }
  if (state.selected.length >= cardsToBottom(state)) return state;
  return { ...state, selected: [...state.selected, uid] };
};

export const confirmBottom = (state: HandState): HandState => {
  if (state.phase !== 'bottoming' || state.selected.length !== cardsToBottom(state)) return state;

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
