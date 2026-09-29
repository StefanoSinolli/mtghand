/**
 * Statistiche sui mulligan con una regola di keep modificabile.
 * La stessa `evaluateHand` giudica le mani simulate e quelle decise dall'utente nel simulatore.
 */

import { canPayPips } from '../game/mana';
import type { ManaSymbolColor } from './manaCost';
import { bottom, isLandish, type SimCard } from './simulate';
import { shuffle } from '../utils/shuffle';

export interface LandRange {
  min: number;
  max: number;
}

export interface KeepRule {
  /** Terre per le mani da 7, 6 e 5 carte (dopo aver messo in fondo) */
  seven: LandRange;
  six: LandRange;
  five: LandRange;
  /** Commander: il primo 7 gratuito si tiene solo con queste terre */
  freeSeven: LandRange;
  /** Almeno una fonte (tra le terre in mano) per ogni colore del mazzo */
  requireAllColors: boolean;
  /** Almeno N magie economiche (costo ≤ cheapThreshold) */
  minCheapSpells: number;
  cheapThreshold: number;
}

/** Regola di Karsten: 2–5 terre a 7, 2–4 a 6 e 5; primo 7 gratuito del Commander con 3–5 */
export const DEFAULT_KEEP_RULE: KeepRule = {
  seven: { min: 2, max: 5 },
  six: { min: 2, max: 4 },
  five: { min: 2, max: 4 },
  freeSeven: { min: 3, max: 5 },
  requireAllColors: false,
  minCheapSpells: 0,
  cheapThreshold: 2,
};

export type MulliganReason = 'fewLands' | 'manyLands' | 'colors' | 'curve';

export const REASON_LABELS: Record<MulliganReason, string> = {
  fewLands: 'poche terre',
  manyLands: 'troppe terre',
  colors: 'colori mancanti',
  curve: 'poche magie economiche',
};

/** Quello che serve della mano per giudicarla */
export interface HandSummary {
  lands: number;
  /** Colori prodotti dalle terre in mano */
  colors: ManaSymbolColor[];
  /** Costi delle magie in mano */
  spellValues: number[];
}

export const summarizeHand = (hand: SimCard[]): HandSummary => ({
  lands: hand.filter(isLandish).length,
  colors: [...new Set(hand.flatMap((c) => c.land?.colors ?? []))],
  spellValues: hand.filter((c) => !isLandish(c)).map((c) => c.manaValue),
});

export interface Verdict {
  keep: boolean;
  reason?: MulliganReason;
}

/**
 * Giudica una mano. `handSize` è la dimensione dopo il fondo; `free` indica il primo 7 gratuito.
 * Le mani da 4 carte o meno si tengono sempre.
 */
export const evaluateHand = (
  hand: HandSummary,
  handSize: number,
  rule: KeepRule,
  deckColors: ManaSymbolColor[],
  free = false,
): Verdict => {
  if (handSize <= 4) return { keep: true };
  const range = free ? rule.freeSeven : handSize >= 7 ? rule.seven : handSize === 6 ? rule.six : rule.five;
  if (hand.lands < range.min) return { keep: false, reason: 'fewLands' };
  if (hand.lands > range.max) return { keep: false, reason: 'manyLands' };
  if (rule.requireAllColors && deckColors.some((c) => !hand.colors.includes(c))) return { keep: false, reason: 'colors' };
  if (hand.spellValues.filter((v) => v <= rule.cheapThreshold).length < rule.minCheapSpells) {
    return { keep: false, reason: 'curve' };
  }
  return { keep: true };
};

/** Si può giocare una magia di costo ≤ `turn` con le sole terre in mano (una per turno) */
const hasPlay = (hand: SimCard[], turn: number) => {
  const lands = hand.filter((c) => c.land);
  if (lands.length < turn) return false;
  const sources = lands.map((c, i) => ({ id: String(i), colors: c.land!.colors, amount: 1 }));
  return hand.some(
    (c) => !isLandish(c) && c.manaValue > 0 && c.manaValue <= turn && c.pips.length <= turn && canPayPips(c.pips, sources),
  );
};

export interface MulliganStatsResult {
  games: number;
  /** Frequenza della dimensione della mano tenuta: 7, 6, 5, 4 o meno */
  keptSizes: { size: number; share: number }[];
  averageHandSize: number;
  averageMulligans: number;
  /** Motivi dei mulligan, in percentuale sul totale dei mulligan */
  reasons: { reason: MulliganReason; share: number }[];
  /** Distribuzione delle terre nelle mani tenute (indice = terre) */
  landsInKeptHand: number[];
  /** Mani tenute con una giocata al T1 / al T2 usando solo le carte in mano */
  turnOnePlay: number;
  turnTwoPlay: number;
}

export interface MulliganStatsOptions {
  games?: number;
  freeFirstMulligan?: boolean;
  deckColors?: ManaSymbolColor[];
  random?: () => number;
}

const HAND_SIZES = [7, 6, 5, 4];

export const simulateMulligans = (
  library: SimCard[],
  rule: KeepRule,
  { games = 10000, freeFirstMulligan = false, deckColors = [], random = Math.random }: MulliganStatsOptions = {},
): MulliganStatsResult => {
  const sizeCounts = new Map<number, number>();
  const reasonCounts = new Map<MulliganReason, number>();
  const lands = new Array<number>(8).fill(0);
  let mulliganTotal = 0;
  let sizeTotal = 0;
  let turnOne = 0;
  let turnTwo = 0;

  // sequenza delle mani: il primo 7 gratuito (Commander), poi 7, 6, 5 e 4 carte
  const steps = [...(freeFirstMulligan ? [{ size: 7, free: true }] : []), ...HAND_SIZES.map((size) => ({ size, free: false }))];

  for (let g = 0; g < games; g++) {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const hand = bottom(shuffle(library, random).slice(0, 7), 7 - step.size);
      const verdict = evaluateHand(summarizeHand(hand), step.size, rule, deckColors, step.free);
      if (verdict.keep || i === steps.length - 1) {
        sizeCounts.set(step.size, (sizeCounts.get(step.size) ?? 0) + 1);
        sizeTotal += step.size;
        mulliganTotal += i;
        lands[Math.min(7, hand.filter(isLandish).length)]++;
        if (hasPlay(hand, 1)) turnOne++;
        if (hasPlay(hand, 2)) turnTwo++;
        break;
      }
      reasonCounts.set(verdict.reason!, (reasonCounts.get(verdict.reason!) ?? 0) + 1);
    }
  }

  const mulligans = [...reasonCounts.values()].reduce((a, b) => a + b, 0);
  return {
    games,
    keptSizes: HAND_SIZES.map((size) => ({ size, share: (sizeCounts.get(size) ?? 0) / games })),
    averageHandSize: sizeTotal / games,
    averageMulligans: mulliganTotal / games,
    reasons: (Object.keys(REASON_LABELS) as MulliganReason[])
      .map((reason) => ({ reason, share: mulligans > 0 ? (reasonCounts.get(reason) ?? 0) / mulligans : 0 }))
      .filter((r) => r.share > 0),
    landsInKeptHand: lands.map((n) => n / games),
    turnOnePlay: turnOne / games,
    turnTwoPlay: turnTwo / games,
  };
};
