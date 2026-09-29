import { describe, expect, it } from 'vitest';
import { countCards, expandEntries, formatDeckList, parseDeckList } from './deckParser';

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
    expect(parseDeckList(formatDeckList(main, side))).toEqual({ main, side, unrecognized: [] });
  });
});
