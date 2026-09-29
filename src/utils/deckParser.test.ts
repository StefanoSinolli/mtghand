import { describe, expect, it } from 'vitest';
import { buildImport, commanderCandidates, countCards, expandEntries, formatDeckList, parseDeckList, suggestFormat } from './deckParser';

describe('parseDeckList', () => {
  it('legge "4 Name", "4x Name" e "Name x4" aggregando i duplicati', () => {
    const { main, side, unrecognized } = parseDeckList(
      '4 Lightning Bolt\n4x Goblin Guide\nRift Bolt x4\n2 Lightning Bolt',
    );
    expect(main).toEqual([
      { name: 'Lightning Bolt', quantity: 6 },
      { name: 'Goblin Guide', quantity: 4 },
      { name: 'Rift Bolt', quantity: 4 },
    ]);
    expect(side).toEqual([]);
    expect(unrecognized).toEqual([]);
  });

  it('separa la sideboard con header esplicito', () => {
    const { main, side } = parseDeckList('4 Lightning Bolt\n\nSideboard\n3 Pyroblast\n2 Skullcrack');
    expect(countCards(main)).toBe(4);
    expect(side).toEqual([
      { name: 'Pyroblast', quantity: 3 },
      { name: 'Skullcrack', quantity: 2 },
    ]);
  });

  it('supporta il formato Arena con set e numero di collezione', () => {
    const { main, side } = parseDeckList(
      'Deck\n4 Lightning Bolt (M10) 146\n2 Fable of the Mirror-Breaker (NEO) 141\n\nSideboard\n1 Abrade (DMU) 114',
    );
    expect(main[0]).toEqual({ name: 'Lightning Bolt', quantity: 4, set: 'm10', collectorNumber: '146' });
    expect(main[1].name).toBe('Fable of the Mirror-Breaker');
    expect(side).toEqual([{ name: 'Abrade', quantity: 1, set: 'dmu', collectorNumber: '114' }]);
  });

  it('usa la riga vuota come separatore sideboard stile MTGO', () => {
    const { main, side } = parseDeckList('4 Lightning Bolt\n20 Mountain\n\n3 Pyroblast');
    expect(countCards(main)).toBe(24);
    expect(side).toEqual([{ name: 'Pyroblast', quantity: 3 }]);
  });

  it('ignora la riga vuota dopo un header esplicito "Deck"', () => {
    const { main, side } = parseDeckList('Deck\n4 Lightning Bolt\n\n20 Mountain');
    expect(countCards(main)).toBe(24);
    expect(side).toEqual([]);
  });

  it('gestisce il prefisso "SB:"', () => {
    const { main, side } = parseDeckList('4 Lightning Bolt\nSB: 2 Skullcrack');
    expect(countCards(main)).toBe(4);
    expect(side).toEqual([{ name: 'Skullcrack', quantity: 2 }]);
  });

  it('mette le carte del companion in sideboard e ignora il commander', () => {
    const { main, side } = parseDeckList('Companion\n1 Lurrus of the Dream-Den\n\nDeck\n4 Ragavan, Nimble Pilferer');
    expect(side).toEqual([{ name: 'Lurrus of the Dream-Den', quantity: 1 }]);
    expect(main).toEqual([{ name: 'Ragavan, Nimble Pilferer', quantity: 4 }]);
  });

  it('ignora commenti e header di categoria', () => {
    const { main } = parseDeckList('// Burn\n# note\nCreatures:\nLands (20)\n4 Goblin Guide');
    expect(main).toEqual([{ name: 'Goblin Guide', quantity: 4 }]);
  });

  it('segnala le righe non riconosciute', () => {
    const { unrecognized } = parseDeckList('4 Lightning Bolt\n0 Mountain\n12');
    expect(unrecognized).toEqual(['0 Mountain', '12']);
  });

  it('gestisce i fine riga Windows', () => {
    const { main } = parseDeckList('4 Lightning Bolt\r\n20 Mountain\r\n');
    expect(countCards(main)).toBe(24);
  });
});

describe('expandEntries / formatDeckList', () => {
  it('espande le quantità e serializza di nuovo', () => {
    const main = [{ name: 'Lightning Bolt', quantity: 2 }];
    const side = [{ name: 'Pyroblast', quantity: 1 }];
    expect(expandEntries(main)).toEqual(['Lightning Bolt', 'Lightning Bolt']);
    expect(parseDeckList(formatDeckList(main, side))).toEqual({ main, side, commanders: [], unrecognized: [] });
  });

  it('serializza e rilegge il comandante', () => {
    const commanders = [{ name: 'Atraxa, Praetors\' Voice', quantity: 1 }];
    const main = [{ name: 'Sol Ring', quantity: 1 }];
    expect(parseDeckList(formatDeckList(main, [], commanders))).toEqual({ main, side: [], commanders, unrecognized: [] });
  });
});

const singletons = (n: number) => Array.from({ length: n }, (_, i) => `1 Carta ${i}`).join('\n');

describe('liste Commander', () => {
  it('legge la sezione Commander di Arena', () => {
    const parsed = parseDeckList(`Commander\n1 Atraxa, Praetors' Voice (CM2) 10\n\nDeck\n1 Sol Ring (C21) 263\n30 Forest`);
    expect(parsed.commanders).toEqual([{ name: "Atraxa, Praetors' Voice", quantity: 1, set: 'cm2', collectorNumber: '10' }]);
    expect(countCards(parsed.main)).toBe(31);
    expect(suggestFormat(parsed).format).toBe('commander');
  });

  it('riconosce il marcatore *CMDR* di Moxfield e toglie i marcatori foil', () => {
    const parsed = parseDeckList(`1 Krenko, Mob Boss *CMDR*\n1 Sol Ring *F*\n20 Mountain`);
    expect(parsed.commanders).toEqual([{ name: 'Krenko, Mob Boss', quantity: 1 }]);
    expect(parsed.main).toEqual([
      { name: 'Sol Ring', quantity: 1 },
      { name: 'Mountain', quantity: 20 },
    ]);
  });

  it('riconosce la categoria [Commander] di Archidekt', () => {
    const parsed = parseDeckList(`1x Krenko, Mob Boss (ddt) 52 [Commander{top}]\n1x Sol Ring (c21) 263 [Ramp] ^Have,#37d67a^`);
    expect(parsed.commanders).toEqual([{ name: 'Krenko, Mob Boss', quantity: 1, set: 'ddt', collectorNumber: '52' }]);
    expect(parsed.main).toEqual([{ name: 'Sol Ring', quantity: 1, set: 'c21', collectorNumber: '263' }]);
  });

  it('convenzione MTGO: 99 carte e il comandante dopo la riga vuota', () => {
    const s = suggestFormat(parseDeckList(`${singletons(69)}\n30 Forest\n\n1 Kenrith, the Returned King`));
    expect(s.format).toBe('commander');
    expect(s.commanders).toEqual([{ name: 'Kenrith, the Returned King', quantity: 1 }]);
    expect(countCards(s.main)).toBe(99);
    expect(s.side).toEqual([]);
  });

  it('100 carte singleton senza comandante: formato Commander, comandante da scegliere', () => {
    const s = suggestFormat(parseDeckList(`${singletons(70)}\n30 Forest`));
    expect(s).toMatchObject({ format: 'commander', commanders: [] });
  });

  it('un mazzo da 60 resta Constructed', () => {
    const s = suggestFormat(parseDeckList('4 Lightning Bolt\n20 Mountain\n36 Goblin Guide\n\n3 Pyroblast'));
    expect(s.format).toBe('constructed60');
    expect(s.side).toEqual([{ name: 'Pyroblast', quantity: 3 }]);
  });
});

describe('buildImport', () => {
  it('Commander con comandante scelto a mano lo toglie dal mazzo', () => {
    const parsed = parseDeckList(`${singletons(69)}\n1 Krenko, Mob Boss\n30 Mountain`);
    expect(commanderCandidates(parsed.main)).toContain('Krenko, Mob Boss');
    expect(commanderCandidates(parsed.main)).not.toContain('Mountain');
    const r = buildImport(parsed, 'commander', 'Krenko, Mob Boss');
    expect(r.commanders).toEqual([{ name: 'Krenko, Mob Boss', quantity: 1 }]);
    expect(countCards(r.main)).toBe(99);
    expect(r.main.find((e) => e.name === 'Krenko, Mob Boss')).toBeUndefined();
  });

  it('Constructed rimette il comandante nel main', () => {
    const parsed = parseDeckList(`Commander\n1 Krenko, Mob Boss\n\nDeck\n20 Mountain`);
    const r = buildImport(parsed, 'constructed60');
    expect(r.commanders).toEqual([]);
    expect(r.main).toEqual([
      { name: 'Mountain', quantity: 20 },
      { name: 'Krenko, Mob Boss', quantity: 1 },
    ]);
  });

  it('convenzione MTGO: il comandante in coda diventa comandante', () => {
    const parsed = parseDeckList(`${singletons(69)}\n30 Forest\n\n1 Kenrith, the Returned King`);
    const r = buildImport(parsed, 'commander');
    expect(r.commanders).toEqual([{ name: 'Kenrith, the Returned King', quantity: 1 }]);
    expect(r.side).toEqual([]);
  });
});
