import { describe, expect, it } from 'vitest';
import {
  hypergeometric,
  landDropProbability,
  openingHandLandDistribution,
  requiredSources,
} from './probability';

describe('ipergeometrica', () => {
  it('calcola valori noti', () => {
    expect(hypergeometric(60, 24, 7, 0)).toBeCloseTo(0.021615, 5);
    // almeno 3 terre in 9 carte (turno 3 on the play)
    expect(landDropProbability(60, 24, 3, true)).toBeCloseTo(0.788654, 5);
  });

  it('la distribuzione della mano iniziale somma a 1', () => {
    const d = openingHandLandDistribution(60, 24);
    expect(d).toHaveLength(8);
    expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
});

// Tabelle pubblicate da Frank Karsten (2022): [costo, turno, simboli, 60/25, 99/41 Commander, 40/17, 60/30]
const KARSTEN_TABLE: Array<[string, number, number, number, number, number, number]> = [
  ['5C', 6, 1, 9, 14, 6, 10],
  ['4C', 5, 1, 9, 15, 6, 11],
  ['3C', 4, 1, 10, 16, 7, 12],
  ['2C', 3, 1, 12, 18, 8, 13],
  ['5CC', 7, 2, 12, 20, 8, 15],
  ['1C', 2, 1, 13, 19, 9, 14],
  ['4CC', 6, 2, 13, 22, 9, 16],
  ['C', 1, 1, 14, 19, 9, 15],
  ['3CC', 5, 2, 15, 23, 10, 17],
  ['4CCC', 7, 3, 16, 26, 10, 19],
  ['2CC', 4, 2, 16, 26, 11, 19],
  ['3CCC', 6, 3, 17, 28, 11, 20],
  ['1CC', 3, 2, 18, 28, 12, 21],
  ['2CCC', 5, 3, 19, 30, 13, 22],
  ['CC', 2, 2, 21, 30, 14, 23],
  ['1CCC', 4, 3, 21, 33, 14, 24],
  ['1CCCC', 5, 4, 22, 36, 15, 26],
  ['CCC', 3, 3, 23, 36, 16, 27],
  ['CCCC', 4, 4, 24, 39, 17, 29],
];

const COMMANDER = { freeFirstMulligan: true, drawOnFirstTurn: true };

describe('modello di Karsten', () => {
  it.each(KARSTEN_TABLE)('%s: riproduce le tabelle 60, 99 Commander, 40 e 60 con 30 terre', (_, turn, pips, t60, t99, t40, t60x30) => {
    expect(requiredSources(60, 25, turn, pips)).toBe(t60);
    expect(requiredSources(99, 41, turn, pips, COMMANDER)).toBe(t99);
    expect(requiredSources(40, 17, turn, pips)).toBe(t40);
    expect(requiredSources(60, 30, turn, pips)).toBe(t60x30);
  });

  it('più simboli dello stesso colore richiedono più fonti', () => {
    expect(requiredSources(60, 24, 3, 3)!).toBeGreaterThan(requiredSources(60, 24, 3, 2)!);
    expect(requiredSources(60, 24, 3, 2)!).toBeGreaterThan(requiredSources(60, 24, 3, 1)!);
  });

  it('con tutte le terre come fonti il requisito è sempre raggiungibile', () => {
    expect(requiredSources(60, 10, 2, 2)).toBe(10);
  });
});
