import { describe, expect, it } from 'vitest';
import { analyzeDeck } from './analyze';
import { requiredSources } from './probability';
import { fixtureCards } from './__fixtures__/load';
import { parseDeckList, suggestFormat } from '../utils/deckParser';
import type { Deck } from '../types';

const commanderDeck = (text: string): Deck => {
  const s = suggestFormat(parseDeckList(text));
  return {
    id: 'cmd',
    name: 'Commander',
    format: 'commander',
    main: s.main,
    side: [],
    commanders: s.commanders,
    schemaVersion: 2,
    createdAt: '',
    updatedAt: '',
  };
};

const KRENKO_SPELLS = `1 Sol Ring
1 Arcane Signet
1 Goblin Matron
1 Skirk Prospector
1 Lightning Bolt
1 Command Tower`;

const analyze = (text: string) => analyzeDeck(commanderDeck(text), fixtureCards);
const errorIds = (text: string) =>
  analyze(text)
    .warnings.filter((w) => w.severity === 'error')
    .map((w) => w.id);

describe('analisi Commander', () => {
  it('un mazzo valido non ha errori di formato', () => {
    const a = analyze(`Commander\n1 Krenko, Mob Boss\n\nDeck\n${KRENKO_SPELLS}\n93 Mountain`);
    expect(a.format).toBe('commander');
    expect(a.deckSize).toBe(99);
    expect(a.commanders.map((c) => c.name)).toEqual(['Krenko, Mob Boss']);
    expect(a.commanderIdentity).toEqual(['R']);
    expect(errorIds(`Commander\n1 Krenko, Mob Boss\n\nDeck\n${KRENKO_SPELLS}\n93 Mountain`)).toEqual([]);
  });

  it('il comandante è un requisito di colore con le soglie del Commander', () => {
    const a = analyze(`Commander\n1 Krenko, Mob Boss\n\nDeck\n${KRENKO_SPELLS}\n38 Mountain\n55 Lightning Bolt`);
    const krenko = a.colors[0].checks.find((c) => c.card === 'Krenko, Mob Boss')!;
    expect(krenko).toMatchObject({ commander: true, turn: 4, pips: 2, manaCost: '{2}{R}{R}' });
    const lands = Math.round(a.lands.weighted);
    expect(krenko.required).toBe(requiredSources(99, lands, 4, 2, { freeFirstMulligan: true, drawOnFirstTurn: true }));
    // il comandante non conta nel costo medio del grimorio
    expect(a.landCount.averageManaValue).toBeLessThan(2);
  });

  it('usa la formula di Karsten per 99 carte', () => {
    const a = analyze(`Commander\n1 Krenko, Mob Boss\n\nDeck\n${KRENKO_SPELLS}\n93 Mountain`);
    const cheap = a.landCount.cheapDrawOrRamp.reduce((s, c) => s + c.quantity, 0);
    expect(a.landCount.recommended).toBeCloseTo(31.42 + 3.13 * a.landCount.averageManaValue - 0.28 * cheap, 5);
  });

  it('segnala identità di colore, copie, carte bannate e dimensione', () => {
    const ids = errorIds(
      `Commander\n1 Krenko, Mob Boss\n\nDeck\n${KRENKO_SPELLS}\n1 Counterspell\n1 Lightning Bolt\n1 Mana Crypt\n1 Dockside Extortionist\n93 Mountain`,
    );
    expect(ids).toEqual(expect.arrayContaining(['deck-size', 'singleton', 'color-identity', 'banned']));
  });

  it('ammette più copie delle carte che lo permettono', () => {
    const ids = errorIds(`Commander\n1 Tymna the Weaver\n\nDeck\n30 Relentless Rats\n69 Swamp`);
    expect(ids).not.toContain('singleton');
  });

  it('senza comandante lo segnala', () => {
    expect(errorIds(`${KRENKO_SPELLS}\n94 Mountain`)).toContain('no-commander');
  });

  it('controlla la validità del comandante e dei partner', () => {
    const base = `\n\nDeck\n98 Forest`;
    expect(errorIds(`Commander\n1 Thrasios, Triton Hero\n1 Tymna the Weaver${base}`)).not.toContain('partners');
    expect(errorIds(`Commander\n1 Wilson, Refined Grizzly\n1 Raised by Giants${base}`)).not.toContain('partners');
    expect(errorIds(`Commander\n1 Krenko, Mob Boss\n1 Atraxa, Praetors' Voice${base}`)).toContain('partners');
    expect(errorIds(`Commander\n1 Grist, the Hunger Tide${base}\n1 Forest`)).not.toContain('invalid-commander-Grist, the Hunger Tide');
    expect(errorIds(`Commander\n1 Sol Ring${base}\n1 Forest`)).toContain('invalid-commander-Sol Ring');
  });
});
