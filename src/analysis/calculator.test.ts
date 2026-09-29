import { describe, expect, it } from 'vitest';
import { buildCalcCards, cardsSeenBy, exactCurve, exactProbability, mulliganCurve, type Condition } from './calculator';
import { buildProfiles } from './analyze';
import { DEFAULT_KEEP_RULE } from './mulliganStats';
import { hypergeometricAtLeast } from './probability';
import { deckFrom, fixtureCards } from './__fixtures__/load';

const seeded = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const BURN = '4 Lightning Bolt\n4 Monastery Swiftspear\n4 Goblin Guide\n4 Lava Spike\n20 Rift Bolt\n24 Mountain';
const profiles = buildProfiles(deckFrom(BURN), fixtureCards).profiles;
const deck = buildCalcCards(profiles);

const atLeast = (n: number, group: Condition['group']): Condition => ({ op: 'atLeast', n, group });

describe('calcolatore esatto', () => {
  it("una condizione coincide con l'ipergeometrica", () => {
    // almeno 1 Lightning Bolt (4 copie) nelle 7 iniziali: 39.95%
    const p = exactProbability(deck, [atLeast(1, { kind: 'cards', names: ['Lightning Bolt'] })], 7);
    expect(p).toBeCloseTo(0.3995, 4);
    expect(p).toBeCloseTo(hypergeometricAtLeast(60, 4, 7, 1), 10);
    expect(exactProbability(deck, [atLeast(3, { kind: 'lands' })], 9)).toBeCloseTo(hypergeometricAtLeast(60, 24, 9, 3), 10);
  });

  it('più carte sommate e operatori', () => {
    const burn = { kind: 'cards' as const, names: ['Lightning Bolt', 'Lava Spike'] };
    expect(exactProbability(deck, [atLeast(1, burn)], 7)).toBeCloseTo(hypergeometricAtLeast(60, 8, 7, 1), 10);
    const exactly0 = exactProbability(deck, [{ op: 'exactly', n: 0, group: burn }], 7);
    const atMost0 = exactProbability(deck, [{ op: 'atMost', n: 0, group: burn }], 7);
    expect(exactly0).toBeCloseTo(1 - hypergeometricAtLeast(60, 8, 7, 1), 10);
    expect(atMost0).toBeCloseTo(exactly0, 10);
  });

  it('condizioni sovrapposte (terre e fonti rosse sono le stesse carte)', () => {
    const lands = exactProbability(deck, [atLeast(2, { kind: 'lands' })], 7);
    const both = exactProbability(deck, [atLeast(2, { kind: 'lands' }), atLeast(2, { kind: 'color', color: 'R' })], 7);
    expect(both).toBeCloseTo(lands, 10);
  });

  it('due condizioni indipendenti: terra + 1-drop', () => {
    const p = exactProbability(deck, [atLeast(1, { kind: 'lands' }), atLeast(1, { kind: 'manaValue', max: 1 })], 7);
    expect(p).toBeGreaterThan(0.85);
    expect(p).toBeLessThan(1);
  });

  it('la curva cresce con i turni e considera la pescata al T1', () => {
    const cond = [atLeast(1, { kind: 'cards', names: ['Goblin Guide'] })];
    const play = exactCurve(deck, cond, 10, false);
    const draw = exactCurve(deck, cond, 10, true);
    expect(play.every((p, i) => i === 0 || p >= play[i - 1])).toBe(true);
    expect(draw[0]).toBeCloseTo(play[1], 10);
    expect(cardsSeenBy(3, false)).toBe(9);
    expect(cardsSeenBy(3, true)).toBe(10);
  });
});

describe('calcolatore con mulligan', () => {
  it("senza condizioni sulle terre coincide con il calcolo esatto (entro l'1%)", () => {
    const cond = [atLeast(1, { kind: 'cards', names: ['Goblin Guide'] })];
    const exact = exactCurve(deck, cond, 4, false);
    const sim = mulliganCurve(profiles, cond, 4, {
      rule: { ...DEFAULT_KEEP_RULE, seven: { min: 0, max: 7 } },
      freeFirstMulligan: false,
      drawOnFirstTurn: false,
      deckColors: [],
      games: 40000,
      random: seeded(7),
    });
    sim.forEach((p, i) => expect(Math.abs(p - exact[i])).toBeLessThan(0.01));
  });

  it('il mulligan migliora la probabilità di avere 3 terre al turno 3', () => {
    const cond = [atLeast(3, { kind: 'lands' })];
    const exact = exactCurve(deck, cond, 3, false)[2];
    const sim = mulliganCurve(profiles, cond, 3, {
      rule: DEFAULT_KEEP_RULE,
      freeFirstMulligan: false,
      drawOnFirstTurn: false,
      deckColors: [],
      games: 20000,
      random: seeded(8),
    })[2];
    expect(sim).toBeGreaterThan(exact);
  });
});

describe('ruoli nel calcolatore', () => {
  const text = '4 Counterspell\n4 Opt\n4 Izzet Signet\n4 Reanimate\n20 Lightning Bolt\n24 Island';
  const ps = buildProfiles(deckFrom(text), fixtureCards).profiles;
  const tagged = new Map([
    ['counterspell', ['counterspell' as const]],
    ['opt', ['cardAdvantage' as const]],
  ]);
  const cards = buildCalcCards(ps, tagged);

  it('unisce etichette di Scryfall e ruoli riconosciuti dal testo', () => {
    const roles = Object.fromEntries(cards.map((c) => [c.name, c.roles]));
    expect(roles['Counterspell']).toEqual(['counterspell']);
    expect(roles['Izzet Signet']).toEqual(['ramp']); // fonte di mana: ramp anche senza etichetta
    expect(roles['Reanimate']).toEqual(['reanimate']);
    expect(roles['Lightning Bolt']).toEqual([]);
  });

  it('carte e ruoli nello stesso gruppo contano insieme', () => {
    const byRole = exactProbability(cards, [atLeast(1, { kind: 'cards', names: [], roles: ['counterspell', 'cardAdvantage'] })], 7);
    expect(byRole).toBeCloseTo(hypergeometricAtLeast(60, 8, 7, 1), 10);
    const mixed = exactProbability(cards, [atLeast(1, { kind: 'cards', names: ['Reanimate'], roles: ['ramp'] })], 7);
    expect(mixed).toBeCloseTo(hypergeometricAtLeast(60, 8, 7, 1), 10);
  });
});
