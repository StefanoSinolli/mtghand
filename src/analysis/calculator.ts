/**
 * Calcolatore di probabilità: "almeno 1 tra X e Y e almeno 2 terre entro il turno 3".
 * Calcolo esatto con l'ipergeometrica multivariata: le carte si dividono in "atomi" in base ai
 * gruppi a cui appartengono (con 3 condizioni al massimo 8 atomi) e si enumerano le pescate.
 * Con il mulligan si usa una simulazione con la regola di keep del mazzo.
 */

import type { CardProfile } from './cardProfile';
import { landColors } from './manaBase';
import type { ManaSymbolColor } from './manaCost';
import { drawKeptHand, type KeepRule } from './mulliganStats';
import { comb } from './probability';
import { buildLibrary, type SimCard } from './simulate';
import { primaryType, type CardType } from '../utils/deckSummary';

export type CardGroup =
  | { kind: 'cards'; names: string[] }
  | { kind: 'lands' }
  | { kind: 'type'; type: CardType }
  | { kind: 'color'; color: ManaSymbolColor }
  | { kind: 'manaValue'; max: number };

export type Operator = 'atLeast' | 'exactly' | 'atMost';

export interface Condition {
  op: Operator;
  n: number;
  group: CardGroup;
}

/** Quello che serve sapere di una carta del mazzo per i gruppi */
export interface CalcCard {
  name: string;
  quantity: number;
  isLand: boolean;
  type: CardType;
  /** Colori che produce se è una terra (fetch risolte) */
  landColors: ManaSymbolColor[];
  /** Costo della magia (null per le terre) */
  manaValue: number | null;
}

export const buildCalcCards = (profiles: CardProfile[]): CalcCard[] =>
  profiles.map((p) => ({
    name: p.name,
    quantity: p.quantity,
    isLand: p.land !== undefined && !p.land.isMdfc,
    type: primaryType(p.card),
    landColors: p.land ? [...landColors(p.land, profiles)] : [],
    manaValue: p.land && !p.land.isMdfc ? null : (p.spells[0]?.manaValue ?? p.card.cmc),
  }));

export const inGroup = (card: CalcCard, group: CardGroup) => {
  switch (group.kind) {
    case 'cards':
      return group.names.includes(card.name);
    case 'lands':
      return card.isLand;
    case 'type':
      return card.type === group.type;
    case 'color':
      return card.landColors.includes(group.color);
    case 'manaValue':
      return card.manaValue !== null && card.manaValue <= group.max;
  }
};

const satisfies = (count: number, { op, n }: Condition) =>
  op === 'atLeast' ? count >= n : op === 'exactly' ? count === n : count <= n;

/** Carte viste entro il turno: 7 + una a turno (on the play niente pescata al primo turno) */
export const cardsSeenBy = (turn: number, drawOnFirstTurn: boolean) => 7 + turn - (drawOnFirstTurn ? 0 : 1);

/** Probabilità esatta che le carte viste soddisfino tutte le condizioni (senza mulligan) */
export const exactProbability = (deck: CalcCard[], conditions: Condition[], cardsSeen: number) => {
  const total = deck.reduce((s, c) => s + c.quantity, 0);
  if (conditions.length === 0 || total === 0) return 1;
  const seen = Math.min(cardsSeen, total);

  // atomi: numero di copie per ogni combinazione di appartenenza ai gruppi
  const atoms = new Map<number, number>();
  for (const card of deck) {
    const mask = conditions.reduce((m, c, i) => (inGroup(card, c.group) ? m | (1 << i) : m), 0);
    atoms.set(mask, (atoms.get(mask) ?? 0) + card.quantity);
  }
  const masks = [...atoms.keys()].filter((m) => m !== 0);
  const others = atoms.get(0) ?? 0;
  const denominator = comb(total, seen);

  let probability = 0;
  const counts = new Array<number>(conditions.length).fill(0);

  // enumera quante carte si pescano da ogni atomo; il resto viene dalle carte fuori da ogni gruppo
  const visit = (index: number, drawn: number, ways: number) => {
    if (index === masks.length) {
      const rest = seen - drawn;
      if (rest < 0 || rest > others) return;
      if (conditions.every((c, i) => satisfies(counts[i], c))) {
        probability += (ways * comb(others, rest)) / denominator;
      }
      return;
    }
    const mask = masks[index];
    const available = atoms.get(mask)!;
    for (let k = 0; k <= Math.min(available, seen - drawn); k++) {
      conditions.forEach((_, i) => {
        if (mask & (1 << i)) counts[i] += k;
      });
      visit(index + 1, drawn + k, ways * comb(available, k));
      conditions.forEach((_, i) => {
        if (mask & (1 << i)) counts[i] -= k;
      });
    }
  };
  visit(0, 0, 1);

  return Math.min(1, probability);
};

/** Probabilità per ogni turno da 1 a `turns`, senza mulligan */
export const exactCurve = (deck: CalcCard[], conditions: Condition[], turns: number, drawOnFirstTurn: boolean) =>
  Array.from({ length: turns }, (_, i) => exactProbability(deck, conditions, cardsSeenBy(i + 1, drawOnFirstTurn)));

export interface MulliganCurveOptions {
  rule: KeepRule;
  freeFirstMulligan: boolean;
  drawOnFirstTurn: boolean;
  deckColors: ManaSymbolColor[];
  games?: number;
  random?: () => number;
}

/**
 * Probabilità per ogni turno considerando il mulligan (simulazione): mano tenuta secondo la regola,
 * poi una carta a turno dal resto del mazzo
 */
export const mulliganCurve = (
  profiles: CardProfile[],
  conditions: Condition[],
  turns: number,
  { rule, freeFirstMulligan, drawOnFirstTurn, deckColors, games = 10000, random = Math.random }: MulliganCurveOptions,
) => {
  const calc = new Map(buildCalcCards(profiles).map((c) => [c.name, c]));
  const library = buildLibrary(profiles);
  // appartenenza ai gruppi per nome, calcolata una volta sola
  const membership = new Map(
    [...calc.values()].map((c) => [c.name, conditions.map((cond) => inGroup(c, cond.group))]),
  );
  const hits = new Array<number>(turns).fill(0);

  for (let g = 0; g < games; g++) {
    const kept = drawKeptHand(library, rule, { freeFirstMulligan, deckColors, random });
    const counts = new Array<number>(conditions.length).fill(0);
    const add = (card: SimCard) =>
      membership.get(card.name)?.forEach((member, i) => {
        if (member) counts[i]++;
      });
    kept.hand.forEach(add);

    for (let turn = 1; turn <= turns; turn++) {
      if (turn > 1 || drawOnFirstTurn) {
        const drawn = kept.library[turn - (drawOnFirstTurn ? 1 : 2)];
        if (drawn) add(drawn);
      }
      if (conditions.every((c, i) => satisfies(counts[i], c))) hits[turn - 1]++;
    }
  }

  return hits.map((h) => h / games);
};
