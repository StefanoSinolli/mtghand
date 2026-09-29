import { describe, expect, it } from 'vitest';
import { payCost } from './mana';

const src = (id: string, colors: string, amount = 1) => ({ id, colors: colors.split('') as never[], amount });

describe('payCost', () => {
  it('paga simboli colorati e generico', () => {
    const sources = [src('m1', 'R'), src('m2', 'R'), src('i1', 'U')];
    expect(payCost([['R']], 1, sources)?.sort()).toEqual(['m1', 'm2']); // conserva l'Isola
    expect(payCost([['U'], ['U']], 0, sources)).toBeNull();
  });

  it('usa le fonti flessibili solo quando servono', () => {
    const sources = [src('dual', 'UR'), src('m', 'R')];
    // {U}{R}: la Montagna paga R, la dual paga U
    expect(payCost([['U'], ['R']], 0, sources)?.sort()).toEqual(['dual', 'm']);
    expect(payCost([['R']], 0, sources)).toEqual(['m']);
  });

  it('Sol Ring produce due mana e il resto non si spreca', () => {
    const sources = [src('sol', 'C', 2), src('m', 'R')];
    expect(payCost([['R']], 2, sources)?.sort()).toEqual(['m', 'sol']);
    expect(payCost([], 1, sources)).toEqual(['sol']);
    expect(payCost([['R']], 3, sources)).toBeNull();
  });

  it('gestisce ibridi e incolore', () => {
    expect(payCost([['W', 'G'], ['W', 'G']], 1, [src('f', 'G'), src('p', 'W'), src('w', 'C')])?.length).toBe(3);
    expect(payCost([['C']], 0, [src('m', 'R')])).toBeNull();
  });
});
