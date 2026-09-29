import { describe, expect, it } from 'vitest';
import { colorKey, groupPips, parseManaCost } from './manaCost';

describe('parseManaCost', () => {
  it('conta generico, colorati e valore di mana', () => {
    const c = parseManaCost('{2}{U}{U}');
    expect(c.generic).toBe(2);
    expect(c.pips).toEqual([['U'], ['U']]);
    expect(c.manaValue).toBe(4);
  });

  it('gestisce X, ibridi, phyrexian, twobrid e incolore', () => {
    expect(parseManaCost('{X}{R}{R}')).toMatchObject({ x: 1, manaValue: 2 });
    expect(parseManaCost('{1}{G/W}{G/W}').pips).toEqual([['G', 'W'], ['G', 'W']]);
    expect(parseManaCost('{R/P}')).toMatchObject({ pips: [], optionalPips: [['R']], manaValue: 1 });
    expect(parseManaCost('{2/W}{2/W}{2/W}')).toMatchObject({ pips: [], manaValue: 6 });
    expect(parseManaCost('{3}{C}').pips).toEqual([['C']]);
    expect(parseManaCost(undefined).manaValue).toBe(0);
  });

  it('raggruppa i simboli per colore', () => {
    expect(groupPips(parseManaCost('{U}{U}{R}').pips)).toEqual(new Map([['U', 2], ['R', 1]]));
    expect(groupPips(parseManaCost('{1}{G/W}{G/W}').pips)).toEqual(new Map([['WG', 2]]));
    expect(colorKey(['R', 'U'])).toBe('UR');
  });
});
