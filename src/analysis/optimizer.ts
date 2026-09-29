/**
 * Ottimizzatore delle terre base.
 * Le terre non-base restano fisse; si prova ogni distribuzione delle base tra i colori
 * richiesti e si sceglie quella che minimizza il deficit di fonti rispetto al modello di Karsten.
 */

import type { ScryfallCard } from '../types';
import { BASIC_TYPE_COLOR, COLOR_BASIC_NAME, type BasicType, type CardProfile } from './cardProfile';
import { keyColors, type ManaSymbolColor } from './manaCost';
import { collectRequirements, countLands, landLikeSource, type Requirement } from './manaBase';
import { CONSTRUCTED_MODEL, requiredSources, type ManaModel } from './probability';

export interface ManaBaseScore {
  /** Somma pesata (per copie) delle fonti mancanti in proporzione alle richieste */
  deficit: number;
  /** Copie di carte con tutti i requisiti soddisfatti / totale */
  satisfiedCopies: number;
  totalCopies: number;
  /** Rapporto fonti/richieste peggiore */
  minRatio: number;
}

export interface BasicChange {
  name: string;
  from: number;
  to: number;
}

export interface OptimizerProposal {
  /** Terre (MDFC a metà) dopo la modifica */
  landCount: number;
  /** Variazione del numero di terre rispetto al mazzo attuale */
  landDelta: number;
  basics: Array<{ name: string; color: ManaSymbolColor; count: number }>;
  changes: BasicChange[];
  before: ManaBaseScore;
  after: ManaBaseScore;
  /** false se nessuna distribuzione di base soddisfa tutti i requisiti: servono terre doppie */
  feasible: boolean;
  /** Fonti per gruppo di colori prima e dopo */
  sources: Array<{ key: string; before: number; after: number }>;
}

const BASIC_COLORS: ManaSymbolColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];

const basicColor = (p: CardProfile): ManaSymbolColor | null => {
  if (!p.land?.isBasic) return null;
  const type = p.land.basicTypes[0] as BasicType | undefined;
  if (type) return BASIC_TYPE_COLOR[type];
  return p.land.produces.includes('C') ? 'C' : null;
};

const syntheticBasic = (name: string, color: ManaSymbolColor): CardProfile => {
  const type = (Object.keys(BASIC_TYPE_COLOR) as BasicType[]).find((t) => BASIC_TYPE_COLOR[t] === color);
  return {
    name,
    quantity: 0,
    card: { id: `basic-${color}`, name, layout: 'normal', cmc: 0, type_line: `Basic Land — ${type ?? ''}`, color_identity: [] } as ScryfallCard,
    land: { produces: [color], tapped: { kind: 'never' }, basicTypes: type ? [type] : [], isBasic: true, isMdfc: false },
    spells: [],
    altPlay: [],
    discardOutlet: false,
    manaValue: null,
    cheapDrawOrRamp: false,
    isCompanion: false,
  };
};

/** Genera tutte le distribuzioni di `total` elementi in `parts` gruppi */
function* compositions(total: number, parts: number): Generator<number[]> {
  if (parts === 1) {
    yield [total];
    return;
  }
  for (let i = 0; i <= total; i++) {
    for (const rest of compositions(total - i, parts - 1)) yield [i, ...rest];
  }
}

interface Evaluator {
  score: (counts: number[]) => ManaBaseScore;
  sourcesFor: (counts: number[]) => Map<string, number>;
}

/**
 * Prepara una funzione di valutazione veloce per una data configurazione di terre fisse
 */
const buildEvaluator = (
  fixed: CardProfile[],
  basicProfiles: CardProfile[],
  colors: ManaSymbolColor[],
  requirements: Requirement[],
  deckSize: number,
  landCount: number,
  model: ManaModel,
): Evaluator => {
  const keys = [...new Set(requirements.map((r) => r.key))];
  const required = new Map(requirements.map((r) => [r, requiredSources(deckSize, landCount, r.turn, r.pips, model)]));

  // Fonti non-terra per chiave e turno (non dipendono dalle base)
  const support = new Map<string, number>();
  for (const r of requirements) {
    const k = `${r.key}:${r.turn}`;
    if (support.has(k)) continue;
    let total = 0;
    for (const p of fixed) {
      const s = p.nonLandSource;
      if (s && s.manaValue < r.turn && keyColors(r.key).some((c) => s.produces.includes(c))) {
        total += s.weight * p.quantity;
      }
    }
    support.set(k, total);
  }

  // Fonti fisse (terre non-base, MDFC, landcycler) per chiave e turno, in base a quali base sono
  // presenti: fetch e landcycling trovano solo le terre che ci sono nel mazzo
  const DISPLAY_TURN = 99;
  const slots = [
    ...new Set([...requirements.map((r) => `${r.key}:${r.turn}`), ...keys.map((k) => `${k}:${DISPLAY_TURN}`)]),
  ].map((slot) => {
    const [key, turn] = slot.split(':');
    return { slot, colors: keyColors(key), turn: Number(turn) };
  });
  const fixedLandLike = fixed.filter((p) => (p.land || p.landcycling) && p.quantity > 0);
  const fixedCache = new Map<number, Map<string, number>>();
  const fixedSources = (counts: number[]) => {
    const mask = counts.reduce((m, c, i) => (c > 0 ? m | (1 << i) : m), 0);
    let cached = fixedCache.get(mask);
    if (!cached) {
      const present = basicProfiles.map((b, i) => ({ ...b, quantity: counts[i] }));
      const all = [...fixed, ...present];
      cached = new Map(slots.map((s) => [s.slot, 0]));
      for (const p of fixedLandLike) {
        const source = landLikeSource(p, all)!;
        for (const s of slots) {
          if (source.fromTurn <= s.turn && s.colors.some((c) => source.colors.has(c))) {
            cached.set(s.slot, cached.get(s.slot)! + source.weight * p.quantity);
          }
        }
      }
      fixedCache.set(mask, cached);
    }
    return cached;
  };

  const landSources = (counts: number[], key: string, turn: number) => {
    const kc = keyColors(key);
    let total = fixedSources(counts).get(`${key}:${turn}`)!;
    colors.forEach((c, i) => {
      if (kc.includes(c)) total += counts[i];
    });
    return total;
  };

  /** Fonti tra le terre per gruppo di colori (a partita avviata) */
  const sourcesFor = (counts: number[]) => new Map(keys.map((k) => [k, landSources(counts, k, DISPLAY_TURN)]));

  const score = (counts: number[]): ManaBaseScore => {
    const byCard = new Map<string, { copies: number; ok: boolean }>();
    let deficit = 0;
    let minRatio = Infinity;

    for (const r of requirements) {
      const req = required.get(r) ?? landCount + 1;
      const src = landSources(counts, r.key, r.turn) + support.get(`${r.key}:${r.turn}`)!;
      const ratio = src / req;
      minRatio = Math.min(minRatio, ratio);
      if (src < req) deficit += (r.copies * (req - src)) / req;

      const card = byCard.get(r.card) ?? { copies: r.copies, ok: true };
      card.ok &&= src >= req;
      byCard.set(r.card, card);
    }

    let satisfiedCopies = 0;
    let totalCopies = 0;
    for (const c of byCard.values()) {
      totalCopies += c.copies;
      if (c.ok) satisfiedCopies += c.copies;
    }

    return { deficit, satisfiedCopies, totalCopies, minRatio: minRatio === Infinity ? 1 : minRatio };
  };

  return { score, sourcesFor };
};

const EPSILON = 1e-9;

/**
 * Ordine di preferenza: meno deficit; a parità (tipicamente 0, tutto soddisfatto)
 * meno modifiche rispetto al mazzo attuale; poi margine migliore sul colore più esigente.
 */
const better = (a: ManaBaseScore, aChanges: number, b: ManaBaseScore, bChanges: number) => {
  if (Math.abs(a.deficit - b.deficit) > EPSILON) return a.deficit < b.deficit;
  if (aChanges !== bChanges) return aChanges < bChanges;
  return a.minRatio > b.minRatio + EPSILON;
};

/** Oltre questo numero di combinazioni si passa dalla ricerca esaustiva a quella locale */
const EXHAUSTIVE_LIMIT = 20000;

const combinations = (pool: number, parts: number) => {
  let result = 1;
  for (let i = 1; i < parts; i++) result = (result * (pool + i)) / i;
  return result;
};

/**
 * Cerca la distribuzione migliore: esaustiva per spazi piccoli (60 carte), altrimenti ricerca
 * locale (Commander con molte base): da più punti di partenza sposta una base alla volta
 * finché il punteggio migliora.
 */
const search = (
  pool: number,
  parts: number,
  current: number[],
  evaluator: Evaluator,
  changesFrom: (counts: number[]) => number,
) => {
  const isBetter = (a: number[], sa: ManaBaseScore, b: number[], sb: ManaBaseScore) =>
    better(sa, changesFrom(a), sb, changesFrom(b));

  if (combinations(pool, parts) <= EXHAUSTIVE_LIMIT) {
    let best: number[] = [];
    let bestScore: ManaBaseScore | null = null;
    for (const counts of compositions(pool, parts)) {
      const score = evaluator.score(counts);
      if (!bestScore || isBetter(counts, score, best, bestScore)) {
        best = counts;
        bestScore = score;
      }
    }
    return { counts: best, score: bestScore! };
  }

  // Punti di partenza: la distribuzione attuale adattata al totale, e una divisione uniforme
  const fit = (counts: number[]) => {
    const total = counts.reduce((a, b) => a + b, 0);
    const scaled = counts.map((c) => (total > 0 ? Math.floor((c * pool) / total) : Math.floor(pool / parts)));
    let rest = pool - scaled.reduce((a, b) => a + b, 0);
    for (let i = 0; rest > 0; i = (i + 1) % parts, rest--) scaled[i]++;
    return scaled;
  };
  const starts = [fit(current), fit(new Array(parts).fill(1))];

  let best = starts[0];
  let bestScore = evaluator.score(best);
  for (const start of starts) {
    let counts = start;
    let score = evaluator.score(counts);
    for (let improved = true; improved; ) {
      improved = false;
      for (let from = 0; from < parts; from++) {
        if (counts[from] === 0) continue;
        for (let to = 0; to < parts; to++) {
          if (to === from) continue;
          const next = [...counts];
          next[from]--;
          next[to]++;
          const nextScore = evaluator.score(next);
          if (isBetter(next, nextScore, counts, score)) {
            counts = next;
            score = nextScore;
            improved = true;
          }
        }
      }
    }
    if (isBetter(counts, score, best, bestScore)) {
      best = counts;
      bestScore = score;
    }
  }
  return { counts: best, score: bestScore };
};

/**
 * Propone una distribuzione delle terre base.
 */
export interface OptimizerOptions {
  /** Terre base da aggiungere (positivo) o togliere (negativo) */
  landDelta?: number;
  /** Carte da ignorare (es. giocabili solo dal cimitero) */
  exclude?: ReadonlySet<string>;
  model?: ManaModel;
  /** Requisiti fuori dal mazzo, es. il comandante */
  extraRequirements?: Requirement[];
}

export const optimizeBasics = (
  deck: CardProfile[],
  deckSize: number,
  { landDelta = 0, exclude = new Set(), model = CONSTRUCTED_MODEL, extraRequirements = [] }: OptimizerOptions = {},
): OptimizerProposal | null => {
  const requirements = [...collectRequirements(deck), ...extraRequirements].filter(
    (r) => !r.alternative && !exclude.has(r.card),
  );
  const demanded = new Set(requirements.flatMap((r) => keyColors(r.key)));
  const colors = BASIC_COLORS.filter((c) => demanded.has(c));
  if (colors.length === 0) return null;

  const basicsInDeck = deck.filter((p) => basicColor(p) !== null);
  const fixed = deck.filter((p) => basicColor(p) === null);
  const currentBasics = basicsInDeck.reduce((s, p) => s + p.quantity, 0);
  const pool = currentBasics + landDelta;
  if (pool < 0) return null;

  // Nome della base per colore: quella già presente con più copie (es. Snow-Covered Island), o lo standard
  const basicProfiles = colors.map((color) => {
    const existing = basicsInDeck
      .filter((p) => basicColor(p) === color)
      .sort((a, b) => b.quantity - a.quantity)[0];
    return existing ? { ...existing, quantity: 0 } : syntheticBasic(COLOR_BASIC_NAME[color], color);
  });

  const currentCounts = colors.map((c) =>
    basicsInDeck.filter((p) => basicColor(p) === c).reduce((s, p) => s + p.quantity, 0),
  );
  const offColorBasics = currentBasics - currentCounts.reduce((a, b) => a + b, 0);

  const fixedLandCount = countLands(fixed).weighted;
  const landsBefore = fixedLandCount + currentBasics;
  const landsAfter = fixedLandCount + pool;

  const evalBefore = buildEvaluator(fixed, basicProfiles, colors, requirements, deckSize, Math.max(1, Math.round(landsBefore)), model);
  const evalAfter =
    landDelta === 0
      ? evalBefore
      : buildEvaluator(fixed, basicProfiles, colors, requirements, deckSize, Math.max(1, Math.round(landsAfter)), model);

  const changesFrom = (counts: number[]) =>
    counts.reduce((s, c, i) => s + Math.abs(c - currentCounts[i]), 0) + offColorBasics;

  const { counts: best, score: bestScore } = search(pool, colors.length, currentCounts, evalAfter, changesFrom);
  const before = evalBefore.score(currentCounts);
  const sourcesBefore = evalBefore.sourcesFor(currentCounts);
  const sourcesAfter = evalAfter.sourcesFor(best);

  // Differenze per nome: include le base di colori non richiesti, che vanno a 0
  const proposed = new Map(basicProfiles.map((b, i) => [b.name, best![i]]));
  const names = new Set([...basicsInDeck.map((p) => p.name), ...proposed.keys()]);
  const changes: BasicChange[] = [];
  for (const name of names) {
    const from = basicsInDeck.filter((p) => p.name === name).reduce((s, p) => s + p.quantity, 0);
    const to = proposed.get(name) ?? 0;
    if (from !== to) changes.push({ name, from, to });
  }

  return {
    landCount: landsAfter,
    landDelta,
    basics: basicProfiles.map((b, i) => ({ name: b.name, color: colors[i], count: best![i] })),
    changes,
    before,
    after: bestScore,
    feasible: bestScore.deficit < EPSILON,
    sources: [...sourcesAfter.keys()].map((key) => ({
      key,
      before: sourcesBefore.get(key)!,
      after: sourcesAfter.get(key)!,
    })),
  };
};
