import { describe, expect, it } from 'vitest';
import { simulate } from './simulate';
import { buildProfiles } from './analyze';
import { deckFrom, fixtureCards } from './__fixtures__/load';
import { landDropProbability } from './probability';

// PRNG deterministico (mulberry32)
const seeded = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const run = (text: string, games = 4000) =>
  simulate(buildProfiles(deckFrom(text), fixtureCards).profiles, { games, random: seeded(42) });

describe('simulazione', () => {
  it('le frequenze dei mulligan sommano a 1 e la maggior parte delle mani si tiene', () => {
    const r = run('36 Lightning Bolt\n24 Mountain');
    expect(r.mulligans.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(r.mulligans[0]).toBeGreaterThan(0.8);
  });

  it('i land drop sono in linea con il calcolo esatto (il mulligan li migliora)', () => {
    const r = run('36 Lightning Bolt\n24 Mountain');
    const exact = landDropProbability(60, 24, 3, true);
    expect(r.landDrops[2]).toBeGreaterThan(exact - 0.03);
    expect(r.landDrops[2]).toBeLessThan(exact + 0.15);
  });

  it('un mono colore con sole base lancia sempre se ha le terre', () => {
    const r = run('4 Lightning Bolt\n4 Counterspell\n28 Opt\n24 Island');
    const cs = r.casts.find((c) => c.card === 'Counterspell')!;
    const bolt = r.casts.find((c) => c.card === 'Lightning Bolt')!;
    expect(cs.onCurveGivenLands).toBe(1);
    expect(bolt.onCurve).toBe(0); // nessuna fonte rossa
  });

  it('le terre sempre tappate riducono i land drop utilizzabili', () => {
    const tapped = run('36 Lightning Bolt\n24 Spikefield Hazard');
    expect(tapped.untappedLandDrops[1]).toBeLessThan(tapped.landDrops[1] * 0.8);
    const fast = run('36 Lightning Bolt\n24 Spirebluff Canal');
    // le fast land entrano stappate nei primi turni
    expect(fast.untappedLandDrops[1]).toBeCloseTo(fast.landDrops[1], 5);
  });

  it('i colori mancanti abbassano la probabilità di lancio', () => {
    const r = run('4 Counterspell\n32 Lightning Bolt\n2 Island\n22 Mountain');
    const cs = r.casts.find((c) => c.card === 'Counterspell')!;
    expect(cs.onCurveGivenLands).toBeLessThan(0.1);
  });
});
