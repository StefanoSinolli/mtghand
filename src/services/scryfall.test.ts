import { describe, expect, it } from 'vitest';
import { lookupCard, normalizeName } from './scryfall';
import type { ScryfallCard } from '../types';

describe('normalizeName', () => {
  it('usa la faccia frontale, minuscolo e senza accenti', () => {
    expect(normalizeName('Fable of the Mirror-Breaker // Reflection of Kiki-Jiki')).toBe('fable of the mirror-breaker');
    expect(normalizeName('Fire // Ice')).toBe('fire');
    expect(normalizeName('  Lim-Dûl the Necromancer ')).toBe('lim-dul the necromancer');
  });
});

describe('lookupCard', () => {
  const fable = { name: 'Fable of the Mirror-Breaker // Reflection of Kiki-Jiki' } as ScryfallCard;
  const cards = new Map([[normalizeName(fable.name), fable]]);

  it('trova le carte doppie a partire dal nome della faccia frontale', () => {
    expect(lookupCard(cards, 'Fable of the Mirror-Breaker')).toBe(fable);
    expect(lookupCard(cards, 'fable of the mirror-breaker // reflection of kiki-jiki')).toBe(fable);
  });

  it('restituisce un placeholder per le carte sconosciute', () => {
    expect(lookupCard(cards, 'Lightning Blot')).toEqual({ name: 'Lightning Blot', placeholder: true });
  });
});
