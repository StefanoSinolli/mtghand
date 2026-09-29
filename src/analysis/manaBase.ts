/**
 * Fonti di mana e requisiti di colore di un mazzo
 */

import { landWeight, type CardProfile, type FetchAbility, type LandProfile } from './cardProfile';
import { keyColors, type ManaSymbolColor } from './manaCost';
import { requiredSources } from './probability';

/** Colori delle terre del mazzo che un effetto di ricerca (fetch, landcycling) può trovare */
export const fetchableColors = (fetch: FetchAbility, deck: CardProfile[], into = new Set<ManaSymbolColor>()) => {
  for (const target of deck) {
    const t = target.land;
    if (!t || t.isMdfc || t.fetch || target.quantity <= 0) continue;
    if (fetch.basicOnly && !t.isBasic) continue;
    if (fetch.types.length > 0 && !t.basicTypes.some((type) => fetch.types.includes(type))) continue;
    for (const c of t.produces) into.add(c);
  }
  return into;
};

/** Colori che una terra può fornire, risolvendo le fetch sulle terre presenti nel mazzo */
export const landColors = (land: LandProfile, deck: CardProfile[]): Set<ManaSymbolColor> => {
  const colors = new Set(land.produces);
  return land.fetch ? fetchableColors(land.fetch, deck, colors) : colors;
};

export interface LandLikeSource {
  colors: Set<ManaSymbolColor>;
  /** Peso come terra: 1, 0.5 per MDFC e landcycler */
  weight: number;
  /** Primo turno in cui fornisce mana (un landcycler da {1} serve dal turno 2) */
  fromTurn: number;
}

/** Terre, MDFC e carte con landcycling come fonti di mana */
export const landLikeSource = (p: CardProfile, deck: CardProfile[]): LandLikeSource | null => {
  if (p.land) return { colors: landColors(p.land, deck), weight: landWeight(p), fromTurn: 1 };
  if (p.landcycling) {
    return { colors: fetchableColors(p.landcycling, deck), weight: landWeight(p), fromTurn: p.landcycling.cost + 1 };
  }
  return null;
};

const matchesKey = (colors: Set<ManaSymbolColor>, key: string) => keyColors(key).some((c) => colors.has(c));

export interface LandTotals {
  /** Terre con MDFC e landcycler contati a metà (usato nei modelli) */
  weighted: number;
  /** Carte che possono fare da terra, MDFC e landcycler inclusi */
  playable: number;
  mdfc: number;
  landcyclers: number;
}

export const countLands = (deck: CardProfile[]): LandTotals => {
  const totals: LandTotals = { weighted: 0, playable: 0, mdfc: 0, landcyclers: 0 };
  for (const p of deck) {
    if (!p.land && !p.landcycling) continue;
    totals.weighted += landWeight(p) * p.quantity;
    totals.playable += p.quantity;
    if (p.land?.isMdfc) totals.mdfc += p.quantity;
    if (p.landcycling) totals.landcyclers += p.quantity;
  }
  return totals;
};

export interface SourceCount {
  /** Terre (MDFC e landcycler a metà) che producono o possono cercare il colore */
  lands: number;
  /** Fonti non-terra disponibili entro il turno richiesto, già pesate */
  support: number;
  total: number;
  landNames: string[];
  supportNames: string[];
}

export const countSources = (deck: CardProfile[], key: string, turn: number): SourceCount => {
  const result: SourceCount = { lands: 0, support: 0, total: 0, landNames: [], supportNames: [] };

  for (const p of deck) {
    if (p.quantity <= 0) continue;

    const landLike = landLikeSource(p, deck);
    if (landLike) {
      if (landLike.fromTurn <= turn && matchesKey(landLike.colors, key)) {
        result.lands += landLike.weight * p.quantity;
        result.landNames.push(p.name);
      }
    } else if (p.nonLandSource && p.nonLandSource.manaValue < turn) {
      const produces = new Set(p.nonLandSource.produces);
      if (matchesKey(produces, key)) {
        result.support += p.nonLandSource.weight * p.quantity;
        result.supportNames.push(p.name);
      }
    }
  }

  result.total = result.lands + result.support;
  return result;
};

export interface Requirement {
  card: string;
  face: string;
  manaCost: string;
  turn: number;
  /** Gruppo di colori, es. "U" o "GW" per gli ibridi */
  key: string;
  pips: number;
  copies: number;
  alternative: boolean;
}

export const collectRequirements = (deck: CardProfile[]): Requirement[] =>
  deck.flatMap((p) =>
    p.spells.flatMap((face) =>
      [...face.pips].map(([key, pips]) => ({
        card: p.name,
        face: face.name,
        manaCost: face.manaCost,
        turn: face.turn,
        key,
        pips,
        copies: p.quantity,
        alternative: face.alternative,
      })),
    ),
  );

export interface RequirementCheck extends Requirement {
  /** Fonti necessarie secondo il modello di Karsten (null = irraggiungibile) */
  required: number | null;
  sources: SourceCount;
  ok: boolean;
  /** fonti / richieste */
  ratio: number;
}

export const modelLandCount = (deck: CardProfile[]) => Math.max(1, Math.round(countLands(deck).weighted));

export const checkRequirements = (
  deck: CardProfile[],
  deckSize: number,
  requirements = collectRequirements(deck),
): RequirementCheck[] => {
  const lands = modelLandCount(deck);
  const sourceCache = new Map<string, SourceCount>();

  return requirements.map((req) => {
    const cacheKey = `${req.key}:${req.turn}`;
    let sources = sourceCache.get(cacheKey);
    if (!sources) {
      sources = countSources(deck, req.key, req.turn);
      sourceCache.set(cacheKey, sources);
    }

    const required = requiredSources(deckSize, lands, req.turn, req.pips);
    const target = required ?? lands + 1;
    return {
      ...req,
      required,
      sources,
      ok: required !== null && sources.total >= required,
      ratio: sources.total / target,
    };
  });
};
