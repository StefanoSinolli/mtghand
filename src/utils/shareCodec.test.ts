import { describe, expect, it } from 'vitest';
import { decodeDeck, encodeDeck } from './shareCodec';

const deck60 = {
  name: 'Mono Red Burn',
  format: 'constructed60' as const,
  main: [
    { name: 'Lightning Bolt', quantity: 4 },
    { name: 'Mountain', quantity: 20 },
  ],
  side: [{ name: 'Pyroblast', quantity: 3 }],
};

describe('shareCodec', () => {
  it('round-trip di un mazzo da 60 con sideboard', async () => {
    const payload = await encodeDeck(deck60);
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/); // sicuro in un URL
    expect(await decodeDeck(payload)).toEqual({ ...deck60, commanders: [] });
  });

  it('round-trip di un mazzo Commander da 100 carte in un link ragionevole', async () => {
    const main = Array.from({ length: 64 }, (_, i) => ({ name: `Carta di prova numero ${i}`, quantity: 1 }));
    main.push({ name: 'Mountain', quantity: 35 });
    const deck = {
      name: 'Krenko',
      format: 'commander' as const,
      main,
      side: [],
      commanders: [{ name: 'Krenko, Mob Boss', quantity: 1 }],
    };
    const payload = await encodeDeck(deck);
    expect(payload.length).toBeLessThan(1500);
    expect(await decodeDeck(payload)).toEqual(deck);
  });

  it('i nomi con caratteri speciali sopravvivono', async () => {
    const deck = { ...deck60, main: [{ name: 'Lórien Revealed', quantity: 4 }, { name: "Sazacap's Brew", quantity: 1 }] };
    expect((await decodeDeck(await encodeDeck(deck)))?.main).toEqual(deck.main);
  });

  it('restituisce null per link rovinati', async () => {
    expect(await decodeDeck('non-un-mazzo')).toBeNull();
    expect(await decodeDeck('')).toBeNull();
    const payload = await encodeDeck(deck60);
    expect(await decodeDeck(payload.slice(0, 10))).toBeNull();
  });
});
