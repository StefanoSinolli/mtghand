/**
 * Ottimizzatore delle terre base.
 * Le terre non-base restano fisse; si prova ogni distribuzione delle base tra i colori
 * richiesti e si sceglie quella che minimizza il deficit di fonti rispetto al modello di Karsten.
 */

import type { ScryfallCard } from '../types';
import { BASIC_TYPE_COLOR, COLOR_BASIC_NAME, landWeight, type BasicType, type CardProfile } from './cardProfile';
import { keyColors, type ManaSymbolColor } from './manaCost';
import { collectRequirements, countLands, landColors, type Requirement } from './manaBase';
import { requiredSources } from './probability';

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
): Evaluator => {
  const keys = [...new Set(requirements.map((r) => r.key))];
  const required = new Map(requirements.map((r) => [r, requiredSources(deckSize, landCount, r.turn, r.pips)]));

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

  // Colori delle terre fisse in base a quali base sono presenti (le fetch dipendono da questo)
  const fixedLands = fixed.filter((p) => p.land && p.quantity > 0);
  const fixedCache = new Map<number, Map<string, number>>();
  const fixedSources = (counts: number[]) => {
    const mask = counts.reduce((m, c, i) => (c > 0 ? m | (1 << i) : m), 0);
    let cached = fixedCache.get(mask);
    if (!cached) {
      const present = basicProfiles.map((b, i) => ({ ...b, quantity: counts[i] }));
      const all = [...fixed, ...present];
      cached = new Map(keys.map((k) => [k, 0]));
      for (const p of fixedLands) {
        const lc = landColors(p.land!, all);
        for (const k of keys) {
          if (keyColors(k).some((c) => lc.has(c))) cached.set(k, cached.get(k)! + landWeight(p) * p.quantity);
        }
      }
      fixedCache.set(mask, cached);
    }
    return cached;
  };

  const sourcesFor = (counts: number[]) => {
    const base = fixedSources(counts);
    const result = new Map<string, number>();
    for (const k of keys) {
      const kc = keyColors(k);
      let total = base.get(k)!;
      colors.forEach((c, i) => {
        if (kc.includes(c)) total += counts[i];
      });
      result.set(k, total);
    }
    return result;
  };

  const score = (counts: number[]): ManaBaseScore => {
    const lands = sourcesFor(counts);
    const byCard = new Map<string, { copies: number; ok: boolean }>();
    let deficit = 0;
    let minRatio = Infinity;

    for (const r of requirements) {
      const req = required.get(r) ?? landCount + 1;
      const src = lands.get(r.key)! + support.get(`${r.key}:${r.turn}`)!;
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

/**
 * Propone una distribuzione delle terre base.
 * @param landDelta terre base da aggiungere (positivo) o togliere (negativo)
 */
export const optimizeBasics = (
  deck: CardProfile[],
  deckSize: number,
  landDelta = 0,
): OptimizerProposal | null => {
  const requirements = collectRequirements(deck).filter((r) => !r.alternative);
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

  const evalBefore = buildEvaluator(fixed, basicProfiles, colors, requirements, deckSize, Math.max(1, Math.round(landsBefore)));
  const evalAfter =
    landDelta === 0
      ? evalBefore
      : buildEvaluator(fixed, basicProfiles, colors, requirements, deckSize, Math.max(1, Math.round(landsAfter)));

  const changesFrom = (counts: number[]) =>
    counts.reduce((s, c, i) => s + Math.abs(c - currentCounts[i]), 0) + offColorBasics;

  let best: number[] | null = null;
  let bestScore: ManaBaseScore | null = null;
  for (const counts of compositions(pool, colors.length)) {
    const s = evalAfter.score(counts);
    if (!best || better(s, changesFrom(counts), bestScore!, changesFrom(best))) {
      best = counts;
      bestScore = s;
    }
  }
  if (!best || !bestScore) return null;

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
