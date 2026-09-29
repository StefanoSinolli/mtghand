/**
 * Analisi completa della mana base di un mazzo
 */

import type { Deck, ScryfallCard } from '../types';
import { normalizeName } from '../services/scryfall';
import { profileCard, type CardProfile } from './cardProfile';
import { checkRequirements, countLands, landColors, type LandTotals, type RequirementCheck } from './manaBase';
import { keyColors } from './manaCost';
import { landDropProbability, openingHandLandDistribution } from './probability';
import { optimizeBasics, type OptimizerProposal } from './optimizer';
import { buildWarnings, type Warning } from './warnings';

export interface LandCountAdvice {
  current: number;
  /** Valore della formula di Karsten, non arrotondato */
  recommended: number;
  averageManaValue: number;
  cheapDrawOrRamp: Array<{ name: string; quantity: number }>;
  hasCompanion: boolean;
}

export interface ColorSummary {
  key: string;
  /** Fonti tra le terre (MDFC a metà) */
  landSources: number;
  /** Requisito peggiore (rapporto fonti/richieste più basso) */
  worst: RequirementCheck;
  /** Requisiti di questo gruppo, dal più esigente */
  checks: RequirementCheck[];
  ok: boolean;
}

export interface OpeningHandStats {
  /** P(k terre nella mano da 7), indice = k */
  distribution: number[];
  keepable: number;
  screw: number;
  flood: number;
  landDrops: Array<{ turn: number; play: number; draw: number }>;
}

export interface TappedLandStats {
  always: Array<{ name: string; quantity: number }>;
  conditional: Array<{ name: string; quantity: number }>;
}

export interface DeckAnalysis {
  deckSize: number;
  profiles: CardProfile[];
  missing: string[];
  lands: LandTotals;
  landCount: LandCountAdvice;
  colors: ColorSummary[];
  /** Requisiti delle facce alternative (split, avventure), mostrati a parte */
  alternativeChecks: RequirementCheck[];
  openingHand: OpeningHandStats;
  tapped: TappedLandStats;
  warnings: Warning[];
  /** Ridistribuzione delle base a parità di terre */
  optimizer: OptimizerProposal | null;
  /** Proposta con il numero di terre consigliato (se diverso) */
  optimizerWithLandCount: OptimizerProposal | null;
}

/** Formula di Karsten per mazzi da 60 carte */
export const karstenLandCount = (averageManaValue: number, cheapDrawOrRamp: number, companion: boolean) =>
  19.59 + 1.9 * averageManaValue - 0.28 * cheapDrawOrRamp + (companion ? 0.27 : 0);

export const buildProfiles = (deck: Deck, cards: Map<string, ScryfallCard>) => {
  const profiles: CardProfile[] = [];
  const sideProfiles: CardProfile[] = [];
  const missing: string[] = [];

  for (const [entries, target, side] of [
    [deck.main, profiles, false],
    [deck.side, sideProfiles, true],
  ] as const) {
    for (const entry of entries) {
      const card = cards.get(normalizeName(entry.name));
      if (card) {
        target.push(profileCard(card, entry.quantity, side));
      } else if (!side) {
        missing.push(entry.name);
      }
    }
  }

  return { profiles, sideProfiles, missing };
};

const landCountAdvice = (profiles: CardProfile[], lands: LandTotals, companion: boolean): LandCountAdvice => {
  let mvSum = 0;
  let mvCount = 0;
  const cheap: Array<{ name: string; quantity: number }> = [];

  for (const p of profiles) {
    if (p.manaValue !== null) {
      mvSum += p.manaValue * p.quantity;
      mvCount += p.quantity;
    }
    if (p.cheapDrawOrRamp) cheap.push({ name: p.name, quantity: p.quantity });
  }

  const averageManaValue = mvCount > 0 ? mvSum / mvCount : 0;
  const cheapCount = cheap.reduce((s, c) => s + c.quantity, 0);

  return {
    current: lands.weighted,
    recommended: karstenLandCount(averageManaValue, cheapCount, companion),
    averageManaValue,
    cheapDrawOrRamp: cheap,
    hasCompanion: companion,
  };
};

const summarizeColors = (checks: RequirementCheck[], profiles: CardProfile[]): ColorSummary[] => {
  const byKey = new Map<string, RequirementCheck[]>();
  for (const c of checks) byKey.set(c.key, [...(byKey.get(c.key) ?? []), c]);

  return [...byKey].map(([key, list]) => {
    const sorted = [...list].sort((a, b) => (b.required ?? 99) - (a.required ?? 99) || a.turn - b.turn);
    const worst = [...list].sort((a, b) => a.ratio - b.ratio)[0];
    const landSources = profiles
      .filter((p) => p.land && keyColors(key).some((c) => landColors(p.land!, profiles).has(c)))
      .reduce((s, p) => s + (p.land!.isMdfc ? 0.5 : 1) * p.quantity, 0);
    return { key, landSources, worst, checks: sorted, ok: list.every((c) => c.ok) };
  });
};

const openingHandStats = (deckSize: number, playableLands: number): OpeningHandStats => {
  const distribution = openingHandLandDistribution(deckSize, playableLands);
  const sum = (from: number, to: number) => distribution.slice(from, to + 1).reduce((a, b) => a + b, 0);
  return {
    distribution,
    keepable: sum(2, 5),
    screw: sum(0, 1),
    flood: sum(6, 7),
    landDrops: [1, 2, 3, 4, 5].map((turn) => ({
      turn,
      play: landDropProbability(deckSize, playableLands, turn, true),
      draw: landDropProbability(deckSize, playableLands, turn, false),
    })),
  };
};

const tappedStats = (profiles: CardProfile[]): TappedLandStats => {
  const always: TappedLandStats['always'] = [];
  const conditional: TappedLandStats['conditional'] = [];
  for (const p of profiles) {
    if (!p.land) continue;
    const alwaysTapped = p.land.tapped.kind === 'always' || p.land.fetch?.entersTapped;
    if (alwaysTapped) always.push({ name: p.name, quantity: p.quantity });
    else if (p.land.tapped.kind !== 'never') conditional.push({ name: p.name, quantity: p.quantity });
  }
  return { always, conditional };
};

export const analyzeDeck = (deck: Deck, cards: Map<string, ScryfallCard>): DeckAnalysis => {
  const { profiles, sideProfiles, missing } = buildProfiles(deck, cards);
  const deckSize = deck.main.reduce((s, e) => s + e.quantity, 0);

  const lands = countLands(profiles);
  const hasCompanion = sideProfiles.some((p) => p.isCompanion);
  const landCount = landCountAdvice(profiles, lands, hasCompanion);

  const checks = checkRequirements(profiles, deckSize);
  const colors = summarizeColors(
    checks.filter((c) => !c.alternative),
    profiles,
  );
  const alternativeChecks = checks.filter((c) => c.alternative);
  const openingHand = openingHandStats(deckSize, lands.playable);
  const tapped = tappedStats(profiles);

  const optimizer = optimizeBasics(profiles, deckSize);
  const landDelta = Math.round(landCount.recommended - lands.weighted);
  const optimizerWithLandCount = landDelta !== 0 ? optimizeBasics(profiles, deckSize, landDelta) : null;

  const analysis: DeckAnalysis = {
    deckSize,
    profiles,
    missing,
    lands,
    landCount,
    colors,
    alternativeChecks,
    openingHand,
    tapped,
    warnings: [],
    optimizer,
    optimizerWithLandCount,
  };
  analysis.warnings = buildWarnings(analysis);
  return analysis;
};
