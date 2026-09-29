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

describe('modello di Karsten', () => {
  // Valori della tabella 2022 per 60 carte che il modello riproduce con 25 terre
  const table: Array<[turn: number, pips: number, sources: number]> = [
    [1, 1, 14], [2, 1, 13], [3, 1, 12], [4, 1, 10], [5, 1, 9], [6, 1, 9],
    [2, 2, 21], [3, 2, 18], [4, 2, 16], [5, 2, 15], [6, 2, 13],
    [3, 3, 23], [4, 3, 21], [5, 3, 19], [4, 4, 24],
  ];

  it.each(table)('turno %i con %i simboli → %i fonti', (turn, pips, sources) => {
    expect(requiredSources(60, 25, turn, pips)).toBe(sources);
  });

  it('con meno terre servono proporzionalmente più fonti', () => {
    expect(requiredSources(60, 20, 1, 1)).toBeGreaterThanOrEqual(12);
    expect(requiredSources(60, 20, 1, 1)).toBeLessThanOrEqual(20);
  });

  it('con tutte le terre come fonti il requisito è sempre raggiungibile', () => {
    expect(requiredSources(60, 10, 2, 2)).toBe(10);
  });

  it('più simboli dello stesso colore richiedono più fonti', () => {
    expect(requiredSources(60, 24, 3, 3)!).toBeGreaterThan(requiredSources(60, 24, 3, 2)!);
    expect(requiredSources(60, 24, 3, 2)!).toBeGreaterThan(requiredSources(60, 24, 3, 1)!);
  });
});
