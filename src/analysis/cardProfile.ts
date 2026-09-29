/**
 * Classificazione di una carta Scryfall ai fini dell'analisi della mana base
 */

import type { ScryfallCard } from '../types';
import { COLORS, groupPips, parseManaCost, type ManaSymbolColor } from './manaCost';

export const BASIC_TYPES = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'] as const;
export type BasicType = (typeof BASIC_TYPES)[number];

export const BASIC_TYPE_COLOR: Record<BasicType, ManaSymbolColor> = {
  Plains: 'W',
  Island: 'U',
  Swamp: 'B',
  Mountain: 'R',
  Forest: 'G',
};

export const COLOR_BASIC_NAME: Record<ManaSymbolColor, string> = {
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
  C: 'Wastes',
};

/**
 * Come entra in gioco una terra:
 * - never: sempre stappata
 * - always: sempre tappata
 * - shock: puoi pagare vita per farla entrare stappata
 * - fast: stappata se controlli al massimo due altre terre
 * - slow: tappata se controlli due o più altre terre
 * - check: stappata se controlli una terra dei tipi indicati
 * - conditional: altre condizioni
 */
export type TappedRule =
  | { kind: 'never' }
  | { kind: 'always' }
  | { kind: 'shock' }
  | { kind: 'fast' }
  | { kind: 'slow' }
  | { kind: 'check'; types: BasicType[] }
  | { kind: 'conditional' };

export interface FetchAbility {
  /** Tipi di terra base cercabili; vuoto = qualsiasi terra (base, se basicOnly) */
  types: BasicType[];
  basicOnly: boolean;
  /** La terra cercata entra tappata (Evolving Wilds, Fabled Passage) */
  entersTapped: boolean;
}

export interface LandProfile {
  /** Colori prodotti direttamente (incluso 'C') */
  produces: ManaSymbolColor[];
  fetch?: FetchAbility;
  tapped: TappedRule;
  basicTypes: BasicType[];
  isBasic: boolean;
  /** Carta spell // terra (MDFC): conta come mezza terra */
  isMdfc: boolean;
}

export interface NonLandSource {
  kind: 'rock' | 'dork';
  produces: ManaSymbolColor[];
  manaValue: number;
  /** Peso come fonte: 1 artefatti, 0.5 creature (più fragili) */
  weight: number;
}

export interface SpellFace {
  name: string;
  manaCost: string;
  manaValue: number;
  /** Turno in cui la carta andrebbe lanciata (valore di mana, X = 1) */
  turn: number;
  /** Simboli obbligatori per gruppo di colori, es. { U: 2 } */
  pips: Map<string, number>;
  /** Faccia alternativa (seconda metà di split, avventura, retro MDFC) */
  alternative: boolean;
}

export interface CardProfile {
  name: string;
  quantity: number;
  card: ScryfallCard;
  land?: LandProfile;
  spells: SpellFace[];
  /** Valore di mana usato per il costo medio del mazzo (null = escluso) */
  manaValue: number | null;
  nonLandSource?: NonLandSource;
  /** Pescata o ramp economico (conta nella formula di Karsten) */
  cheapDrawOrRamp: boolean;
  isCompanion: boolean;
}

const isLandType = (typeLine = '') => /\bLand\b/.test(typeLine);

const faceList = (card: ScryfallCard) =>
  card.card_faces && card.card_faces.length > 0
    ? card.card_faces
    : [{ name: card.name, mana_cost: card.mana_cost, type_line: card.type_line, oracle_text: card.oracle_text }];

const basicTypesOf = (typeLine = ''): BasicType[] => {
  const subtypes = typeLine.split('—')[1] ?? '';
  return BASIC_TYPES.filter((t) => new RegExp(`\\b${t}\\b`).test(subtypes));
};

const parseFetch = (oracle = ''): FetchAbility | undefined => {
  const match = oracle.match(/search your library for (?:an?|up to \w+) ([^.]*?)cards?\b([^.]*)/i);
  if (!match) return undefined;

  const target = match[1];
  const types = BASIC_TYPES.filter((t) => target.includes(t));
  if (types.length === 0 && !/\bland\b/i.test(target)) return undefined;

  return {
    types,
    basicOnly: /\bbasic\b/i.test(target),
    entersTapped: /onto the battlefield tapped/i.test(match[2]),
  };
};

const parseTapped = (oracle = ''): TappedRule => {
  const sentences = oracle.split(/\n|(?<=\.)\s+/);
  const sentence = sentences.find((s) => /enters(?: the battlefield)? tapped/i.test(s));
  if (!sentence) return { kind: 'never' };

  // "As this land enters, you may pay 2 life. If you don't, it enters tapped."
  if (/if you don't/i.test(sentence)) return { kind: 'shock' };
  if (/unless you control two or fewer other lands/i.test(sentence)) return { kind: 'fast' };
  if (/if you control two or more other lands/i.test(sentence)) return { kind: 'slow' };

  const check = sentence.match(/unless you control an? (.+?)$/i);
  if (check) {
    const types = BASIC_TYPES.filter((t) => check[1].includes(t));
    if (types.length > 0) return { kind: 'check', types };
  }

  if (/\bunless\b|^if\b/i.test(sentence)) return { kind: 'conditional' };
  return { kind: 'always' };
};

const producedColors = (card: ScryfallCard): ManaSymbolColor[] =>
  (card.produced_mana ?? []).filter((c): c is ManaSymbolColor => c === 'C' || (COLORS as string[]).includes(c));

const buildSpellFace = (name: string, manaCost: string, alternative: boolean): SpellFace => {
  const cost = parseManaCost(manaCost);
  return {
    name,
    manaCost,
    manaValue: cost.manaValue,
    turn: Math.max(1, cost.manaValue + cost.x),
    pips: groupPips(cost.pips),
    alternative,
  };
};

const CHEAP_DRAW = /\bdraws? (?:a|two|three) cards?\b|look at the top [^\n]*?put (?:one|two|it|that card)[^.]* into your hand/i;
const CHEAP_RAMP = /search your library for (?:a|up to \w+) basic lands?/i;

export const profileCard = (card: ScryfallCard, quantity: number, inSideboard = false): CardProfile => {
  const faces = faceList(card);
  const front = faces[0];
  const frontIsLand = isLandType(front.type_line ?? card.type_line);
  const landFace = faces.find((f) => isLandType(f.type_line));

  const profile: CardProfile = {
    name: card.name,
    quantity,
    card,
    spells: [],
    manaValue: null,
    cheapDrawOrRamp: false,
    isCompanion: inSideboard && /^Companion —/m.test(front.oracle_text ?? card.oracle_text ?? ''),
  };

  if (landFace) {
    const oracle = landFace.oracle_text ?? card.oracle_text ?? '';
    profile.land = {
      produces: producedColors(card),
      fetch: parseFetch(oracle),
      tapped: parseTapped(oracle),
      basicTypes: basicTypesOf(landFace.type_line),
      isBasic: /\bBasic\b/.test(landFace.type_line ?? ''),
      isMdfc: !frontIsLand,
    };
  }

  if (!frontIsLand) {
    // Facce lanciabili: per split e avventura entrambe; per MDFC anche il retro se non è una terra;
    // per le carte che si trasformano solo il fronte
    const castable =
      card.layout === 'split' || card.layout === 'adventure' || card.layout === 'modal_dfc'
        ? faces.filter((f) => f.mana_cost !== undefined && !isLandType(f.type_line))
        : [front];

    profile.spells = castable.map((f, i) =>
      buildSpellFace(f.name, f.mana_cost ?? card.mana_cost ?? '', i > 0),
    );

    if (!profile.land) {
      const values = profile.spells.map((s) => s.manaValue);
      profile.manaValue = card.layout === 'split' ? Math.min(...values) : (values[0] ?? card.cmc);
    }

    const mv = profile.spells[0]?.manaValue ?? card.cmc;
    const typeLine = front.type_line ?? card.type_line;
    const produces = producedColors(card);

    // Fonti non-terra: solo permanenti economici (instant/sorcery come Dark Ritual o
    // Deadly Dispute producono mana una volta sola e non contano come fonte)
    if (!profile.land && produces.length > 0 && mv <= 3 && /\b(Artifact|Creature)\b/.test(typeLine)) {
      const isCreature = /\bCreature\b/.test(typeLine);
      profile.nonLandSource = {
        kind: isCreature ? 'dork' : 'rock',
        produces,
        manaValue: mv,
        weight: isCreature ? 0.5 : 1,
      };
    }

    const oracle = faces.map((f) => f.oracle_text ?? '').join('\n') || (card.oracle_text ?? '');
    profile.cheapDrawOrRamp =
      !profile.land &&
      mv <= 2 &&
      (profile.nonLandSource !== undefined ||
        (!/\bCreature\b/.test(typeLine) && (CHEAP_DRAW.test(oracle) || CHEAP_RAMP.test(oracle))));
  }

  return profile;
};

/** Peso della carta come terra: 1, oppure 0.5 per le MDFC spell // terra */
export const landWeight = (profile: CardProfile) => (profile.land ? (profile.land.isMdfc ? 0.5 : 1) : 0);
