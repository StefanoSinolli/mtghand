import { describe, expect, it } from 'vitest';
import { canMulligan, cardsToBottom, confirmBottom, keep, MAX_BOTTOM, mulligan, newGame, toggleBottom, type HandState } from './london';

const DECK = [
  { name: 'Lightning Bolt', quantity: 40 },
  { name: 'Mountain', quantity: 20 },
];

// PRNG deterministico (mulberry32) per test ripetibili
const seeded = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const total = (s: HandState) => s.hand.length + s.library.length;
const uniqueUids = (s: HandState) => new Set([...s.hand, ...s.library].map((c) => c.uid)).size;

describe('London mulligan', () => {
  it('pesca 7 carte da un mazzo di 60', () => {
    const s = newGame(DECK, {}, seeded(1));
    expect(s.phase).toBe('deciding');
    expect(s.hand).toHaveLength(7);
    expect(s.library).toHaveLength(53);
    expect(uniqueUids(s)).toBe(60);
  });

  it('keep senza mulligan va direttamente in "kept"', () => {
    const s = keep(newGame(DECK, {}, seeded(1)));
    expect(s.phase).toBe('kept');
    expect(s.hand).toHaveLength(7);
  });

  it('dopo 2 mulligan si ripescano 7 carte e al keep se ne mettono 2 in fondo', () => {
    const random = seeded(2);
    let s = newGame(DECK, {}, random);
    s = mulligan(s, random);
    s = mulligan(s, random);

    expect(s.mulligans).toBe(2);
    expect(s.phase).toBe('deciding');
    expect(s.hand).toHaveLength(7);
    expect(total(s)).toBe(60);

    s = keep(s);
    expect(s.phase).toBe('bottoming');

    const [a, b, c] = s.hand;
    s = toggleBottom(s, a.uid);
    s = toggleBottom(s, b.uid);
    s = toggleBottom(s, c.uid); // oltre il limite: ignorata
    expect(s.selected).toEqual([a.uid, b.uid]);

    s = confirmBottom(s);
    expect(s.phase).toBe('kept');
    expect(s.hand).toHaveLength(5);
    expect(s.library).toHaveLength(55);
    expect(s.library.slice(-2)).toEqual([a, b]);
    expect(uniqueUids(s)).toBe(60);
  });

  it('non conferma il bottom finché non sono state scelte abbastanza carte', () => {
    const random = seeded(3);
    let s = keep(mulligan(newGame(DECK, {}, random), random));
    expect(confirmBottom(s)).toBe(s);

    s = toggleBottom(s, s.hand[0].uid);
    s = toggleBottom(s, s.hand[0].uid); // deseleziona
    expect(s.selected).toEqual([]);
  });

  it('non permette mulligan dopo il keep né oltre il massimo', () => {
    const random = seeded(4);
    const kept = keep(newGame(DECK, {}, random));
    expect(canMulligan(kept)).toBe(false);
    expect(mulligan(kept, random)).toBe(kept);

    let s = newGame(DECK, {}, random);
    for (let i = 0; i < 10; i++) s = mulligan(s, random);
    expect(s.mulligans).toBe(MAX_BOTTOM);
    expect(canMulligan(s)).toBe(false);
  });

  it('Commander: il primo mulligan è gratuito', () => {
    const random = seeded(5);
    let s = newGame(DECK, { freeFirstMulligan: true }, random);
    s = mulligan(s, random);
    expect(cardsToBottom(s)).toBe(0);
    expect(keep(s).phase).toBe('kept');
    expect(keep(s).hand).toHaveLength(7);

    s = mulligan(s, random);
    expect(cardsToBottom(s)).toBe(1);
    s = keep(s);
    expect(s.phase).toBe('bottoming');
    s = confirmBottom(toggleBottom(s, s.hand[0].uid));
    expect(s.hand).toHaveLength(6);
    expect(total(s)).toBe(60);

    // si può arrivare a un mulligan in più
    let m = newGame(DECK, { freeFirstMulligan: true }, random);
    for (let i = 0; i < 10; i++) m = mulligan(m, random);
    expect(m.mulligans).toBe(MAX_BOTTOM + 1);
  });
});
