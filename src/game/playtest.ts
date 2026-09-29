/**
 * Prova di gioco dopo il keep: turni, pescata, una terra per turno, magie pagate con il mana
 * delle terre e delle fonti in gioco (Sol Ring, Signet, creature che producono mana).
 * Funzioni pure: ogni azione restituisce un nuovo stato, con la storia per annullare.
 */

import type { BasicType, CardProfile, TappedRule } from '../analysis/cardProfile';
import { landColors } from '../analysis/manaBase';
import { COLORS, parseManaCost, type ManaSymbolColor } from '../analysis/manaCost';
import type { CardInstance } from '../types';
import { landEntersTapped, payCost, type ManaSource } from './mana';

export interface PlayCardInfo {
  name: string;
  /** Si può giocare come terra (anche il retro di una MDFC) */
  land?: { colors: ManaSymbolColor[]; amount: number; tapped: TappedRule; fetchTapped: boolean; basicTypes: BasicType[] };
  /** Costo della faccia principale; null per le terre */
  cost: { text: string; pips: ManaSymbolColor[][]; generic: number } | null;
  permanent: boolean;
  creature: boolean;
  /** Produce mana una volta in gioco (artefatti, creature) */
  mana?: { colors: ManaSymbolColor[]; amount: number };
}

/** Mana prodotto con un solo tap: "{T}: Add {C}{C}" → 2 */
const manaAmount = (oracle = '') => {
  const match = oracle.match(/\{T\}(?:, [^:]*)?: Add ((?:\{[^}]+\})+)/);
  return match ? (match[1].match(/\{/g)?.length ?? 1) : 1;
};

/** Informazioni di gioco di una carta, a partire dal suo profilo e dal mazzo (per le fetch) */
export const buildCardInfo = (p: CardProfile, deck: CardProfile[]): PlayCardInfo => {
  const oracle = [p.card.oracle_text, ...(p.card.card_faces ?? []).map((f) => f.oracle_text)].join('\n');
  const typeLine = p.card.card_faces?.[0]?.type_line ?? p.card.type_line;
  const face = p.spells[0];
  const parsed = face ? parseManaCost(face.manaCost) : null;

  return {
    name: p.name,
    land: p.land
      ? {
          colors: [...landColors(p.land, deck)],
          amount: manaAmount(oracle),
          tapped: p.land.tapped,
          fetchTapped: p.land.fetch?.entersTapped ?? false,
          basicTypes: p.land.basicTypes,
        }
      : undefined,
    cost: face && parsed ? { text: face.manaCost, pips: parsed.pips, generic: parsed.generic } : null,
    permanent: face !== undefined && !/\b(Instant|Sorcery)\b/.test(typeLine),
    creature: /\bCreature\b/.test(typeLine),
    mana: p.nonLandSource
      ? {
          colors: p.nonLandSource.produces.length === 5 ? [...COLORS] : p.nonLandSource.produces,
          amount: manaAmount(oracle),
        }
      : undefined,
  };
};

export interface BattlefieldCard extends CardInstance {
  tapped: boolean;
  enteredTurn: number;
  /** Giocata come terra (anche una MDFC) */
  asLand: boolean;
}

interface Snapshot {
  turn: number;
  hand: CardInstance[];
  /** Comandanti non ancora in gioco */
  commandZone: CardInstance[];
  library: CardInstance[];
  battlefield: BattlefieldCard[];
  graveyard: CardInstance[];
  landPlayed: boolean;
  log: string[];
}

export interface PlaytestState extends Snapshot {
  history: Snapshot[];
}

export type PlaytestResult = { ok: true; state: PlaytestState } | { ok: false; reason: string };

type InfoOf = (name: string) => PlayCardInfo | undefined;

const snapshot = ({ history: _history, ...rest }: PlaytestState): Snapshot => rest;

const withHistory = (state: PlaytestState, next: Snapshot): PlaytestState => ({
  ...next,
  history: [...state.history, snapshot(state)],
});

const logLine = (turn: number, text: string) => `T${turn} · ${text}`;

/** Inizia dopo il keep: turno 1, con la pescata se il formato la prevede (Commander) */
export const startPlaytest = (
  hand: CardInstance[],
  library: CardInstance[],
  options: { drawOnFirstTurn: boolean; commanders?: CardInstance[] },
): PlaytestState => {
  const draw = options.drawOnFirstTurn && library.length > 0;
  return {
    turn: 1,
    hand: draw ? [...hand, library[0]] : hand,
    commandZone: options.commanders ?? [],
    library: draw ? library.slice(1) : library,
    battlefield: [],
    graveyard: [],
    landPlayed: false,
    log: [logLine(1, draw ? `inizio, pescata ${library[0].name}` : 'inizio (on the play, niente pescata)')],
    history: [],
  };
};

export const nextTurn = (state: PlaytestState): PlaytestState => {
  const turn = state.turn + 1;
  const drawn = state.library[0];
  return withHistory(state, {
    turn,
    hand: drawn ? [...state.hand, drawn] : state.hand,
    commandZone: state.commandZone,
    library: state.library.slice(1),
    battlefield: state.battlefield.map((c) => ({ ...c, tapped: false })),
    graveyard: state.graveyard,
    landPlayed: false,
    log: [...state.log, logLine(turn, drawn ? `pescata ${drawn.name}` : 'grimorio vuoto')],
  });
};

const takeFromHand = (state: PlaytestState, uid: string) => {
  const card = state.hand.find((c) => c.uid === uid);
  return card ? { card, hand: state.hand.filter((c) => c.uid !== uid) } : null;
};

/** Prende la carta dalla mano o dalla zona di comando */
const take = (state: PlaytestState, uid: string) => {
  const fromHand = takeFromHand(state, uid);
  if (fromHand) return { ...fromHand, commandZone: state.commandZone };
  const card = state.commandZone.find((c) => c.uid === uid);
  return card ? { card, hand: state.hand, commandZone: state.commandZone.filter((c) => c.uid !== uid) } : null;
};

export const playLand = (state: PlaytestState, uid: string, infoOf: InfoOf): PlaytestResult => {
  const taken = takeFromHand(state, uid);
  const land = taken && infoOf(taken.card.name)?.land;
  if (!taken || !land) return { ok: false, reason: 'Non è una terra' };
  if (state.landPlayed) return { ok: false, reason: 'Hai già giocato una terra in questo turno' };

  const landsInPlay = state.battlefield
    .filter((c) => c.asLand)
    .map((c) => ({ basicTypes: infoOf(c.name)?.land?.basicTypes ?? [] }));
  const tapped = landEntersTapped(land.tapped, land.fetchTapped, landsInPlay);

  return {
    ok: true,
    state: withHistory(state, {
      ...snapshot(state),
      hand: taken.hand,
      battlefield: [...state.battlefield, { ...taken.card, tapped, enteredTurn: state.turn, asLand: true }],
      landPlayed: true,
      log: [...state.log, logLine(state.turn, `giocata ${taken.card.name}${tapped ? ' (tappata)' : ''}`)],
    }),
  };
};

/** Fonti di mana stappate: terre e permanenti che producono mana (le creature non il turno in cui entrano) */
export const manaSources = (state: PlaytestState, infoOf: InfoOf): ManaSource[] =>
  state.battlefield.flatMap((c) => {
    if (c.tapped) return [];
    const info = infoOf(c.name);
    const mana = c.asLand ? info?.land : info?.mana;
    if (!mana || mana.colors.length === 0) return [];
    if (!c.asLand && info?.creature && c.enteredTurn >= state.turn) return [];
    return [{ id: c.uid, colors: mana.colors, amount: mana.amount }];
  });

export const availableMana = (state: PlaytestState, infoOf: InfoOf) => {
  const sources = manaSources(state, infoOf);
  const colors = new Set(sources.flatMap((s) => s.colors));
  const order: ManaSymbolColor[] = [...COLORS, 'C'];
  return { total: sources.reduce((sum, s) => sum + s.amount, 0), colors: order.filter((c) => colors.has(c)) };
};

const resolve = (
  state: PlaytestState,
  taken: { card: CardInstance; hand: CardInstance[]; commandZone: CardInstance[] },
  tapIds: string[],
  info: PlayCardInfo,
  how: string,
) => {
  const { card, hand, commandZone } = taken;
  return withHistory(state, {
    ...snapshot(state),
    hand,
    commandZone,
    battlefield: [
      ...state.battlefield.map((c) => (tapIds.includes(c.uid) ? { ...c, tapped: true } : c)),
      ...(info.permanent ? [{ ...card, tapped: false, enteredTurn: state.turn, asLand: false }] : []),
    ],
    graveyard: info.permanent ? state.graveyard : [...state.graveyard, card],
    log: [...state.log, logLine(state.turn, `${how} ${card.name}`)],
  });
};

/** Lancia una magia (dalla mano o dalla zona di comando) pagando il costo stampato (X = 0) */
export const cast = (state: PlaytestState, uid: string, infoOf: InfoOf): PlaytestResult => {
  const taken = take(state, uid);
  const info = taken && infoOf(taken.card.name);
  if (!taken || !info?.cost) return { ok: false, reason: 'Questa carta non si lancia' };

  const tapIds = payCost(info.cost.pips, info.cost.generic, manaSources(state, infoOf));
  if (!tapIds) return { ok: false, reason: 'Mana o colori insufficienti' };

  return { ok: true, state: resolve(state, taken, tapIds, info, 'lanciata') };
};

/** Mette in gioco senza pagare: costi ridotti, costi alternativi, effetti che la mettono in gioco */
export const putIntoPlay = (state: PlaytestState, uid: string, infoOf: InfoOf): PlaytestResult => {
  const taken = take(state, uid);
  const info = taken && infoOf(taken.card.name);
  if (!taken || !info) return { ok: false, reason: 'Carta non trovata' };
  return { ok: true, state: resolve(state, taken, [], info, 'risolta senza pagare') };
};

export const discard = (state: PlaytestState, uid: string): PlaytestResult => {
  const taken = takeFromHand(state, uid);
  if (!taken) return { ok: false, reason: 'Carta non trovata' };
  return {
    ok: true,
    state: withHistory(state, {
      ...snapshot(state),
      hand: taken.hand,
      graveyard: [...state.graveyard, taken.card],
      log: [...state.log, logLine(state.turn, `scartata ${taken.card.name}`)],
    }),
  };
};

/** Tappa o stappa a mano un permanente */
export const toggleTap = (state: PlaytestState, uid: string): PlaytestState =>
  withHistory(state, {
    ...snapshot(state),
    battlefield: state.battlefield.map((c) => (c.uid === uid ? { ...c, tapped: !c.tapped } : c)),
  });

export const undo = (state: PlaytestState): PlaytestState => {
  const previous = state.history.at(-1);
  return previous ? { ...previous, history: state.history.slice(0, -1) } : state;
};
