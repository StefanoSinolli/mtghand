import { describe, expect, it } from 'vitest';
import { DEFAULT_KEEP_RULE, evaluateHand, simulateMulligans } from './mulliganStats';
import { buildLibrary, simulate } from './simulate';
import { buildProfiles } from './analyze';
import { deckFrom, fixtureCards } from './__fixtures__/load';

const seeded = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const library = (text: string) => buildLibrary(buildProfiles(deckFrom(text), fixtureCards).profiles);

describe('evaluateHand', () => {
  const hand = { lands: 2, colors: ['R' as const], spellValues: [1, 3, 4, 5, 6] };

  it('applica gli intervalli di terre per dimensione', () => {
    expect(evaluateHand(hand, 7, DEFAULT_KEEP_RULE, ['R'])).toEqual({ keep: true });
    expect(evaluateHand({ ...hand, lands: 1 }, 7, DEFAULT_KEEP_RULE, ['R'])).toEqual({ keep: false, reason: 'fewLands' });
    expect(evaluateHand({ ...hand, lands: 5 }, 6, DEFAULT_KEEP_RULE, ['R'])).toEqual({ keep: false, reason: 'manyLands' });
    expect(evaluateHand({ ...hand, lands: 0 }, 4, DEFAULT_KEEP_RULE, ['R'])).toEqual({ keep: true });
    // primo 7 gratuito del Commander: servono 3 terre
    expect(evaluateHand(hand, 7, DEFAULT_KEEP_RULE, ['R'], true)).toEqual({ keep: false, reason: 'fewLands' });
  });

  it('controlla colori e magie economiche se richiesto', () => {
    const rule = { ...DEFAULT_KEEP_RULE, requireAllColors: true, minCheapSpells: 2 };
    expect(evaluateHand(hand, 7, rule, ['U', 'R'])).toEqual({ keep: false, reason: 'colors' });
    expect(evaluateHand(hand, 7, rule, ['R'])).toEqual({ keep: false, reason: 'curve' });
    expect(evaluateHand({ ...hand, spellValues: [1, 2, 5] }, 7, rule, ['R'])).toEqual({ keep: true });
  });
});

describe('simulateMulligans', () => {
  const burn = library('36 Lightning Bolt\n24 Mountain');

  it('con la regola di Karsten coincide con la simulazione esistente', () => {
    const stats = simulateMulligans(burn, DEFAULT_KEEP_RULE, { games: 20000, random: seeded(1) });
    const sim = simulate(buildProfiles(deckFrom('36 Lightning Bolt\n24 Mountain'), fixtureCards).profiles, {
      games: 20000,
      random: seeded(2),
    });
    expect(stats.keptSizes[0].share).toBeCloseTo(sim.mulligans[0], 1);
    expect(stats.keptSizes.reduce((s, k) => s + k.share, 0)).toBeCloseTo(1, 10);
    expect(stats.averageHandSize).toBeGreaterThan(6.5);
  });

  it('i motivi del mulligan sommano a 1 e le terre nelle mani tenute rispettano la regola', () => {
    const stats = simulateMulligans(burn, DEFAULT_KEEP_RULE, { games: 5000, random: seeded(3) });
    expect(stats.reasons.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 10);
    expect(stats.landsInKeptHand[0] + stats.landsInKeptHand[1]).toBeLessThan(0.02); // solo mani da 4
    expect(stats.turnOnePlay).toBeGreaterThan(0.95); // Bolt + Mountain quasi sempre
  });

  it('una regola più severa fa fare più mulligan', () => {
    const strict = { ...DEFAULT_KEEP_RULE, seven: { min: 3, max: 4 } };
    const a = simulateMulligans(burn, DEFAULT_KEEP_RULE, { games: 5000, random: seeded(4) });
    const b = simulateMulligans(burn, strict, { games: 5000, random: seeded(4) });
    expect(b.averageMulligans).toBeGreaterThan(a.averageMulligans);
  });

  it('richiedere tutti i colori penalizza una mana base sbilanciata', () => {
    const izzet = library('4 Counterspell\n32 Lightning Bolt\n2 Island\n22 Mountain');
    const rule = { ...DEFAULT_KEEP_RULE, requireAllColors: true };
    const stats = simulateMulligans(izzet, rule, { games: 5000, deckColors: ['U', 'R'], random: seeded(5) });
    expect(stats.reasons.find((r) => r.reason === 'colors')!.share).toBeGreaterThan(0.5);
  });
});
