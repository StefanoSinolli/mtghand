import { describe, expect, it } from 'vitest';
import { profileCard } from './cardProfile';
import { fixtureCard } from './__fixtures__/load';

const profile = (name: string, quantity = 1, side = false) => profileCard(fixtureCard(name), quantity, side);

describe('terre', () => {
  it('riconosce le regole di ingresso tappato', () => {
    expect(profile('Mountain').land).toMatchObject({ tapped: { kind: 'never' }, isBasic: true, basicTypes: ['Mountain'] });
    expect(profile('Steam Vents').land).toMatchObject({ tapped: { kind: 'shock' }, basicTypes: ['Island', 'Mountain'] });
    expect(profile('Spirebluff Canal').land?.tapped).toEqual({ kind: 'fast' });
    expect(profile('Den of the Bugbear').land?.tapped).toEqual({ kind: 'slow' });
    expect(profile('Sulfur Falls').land?.tapped).toEqual({ kind: 'check', types: ['Island', 'Mountain'] });
    expect(profile('Spikefield Hazard').land?.tapped).toEqual({ kind: 'always' });
  });

  it('riconosce le fetch', () => {
    expect(profile('Scalding Tarn').land?.fetch).toEqual({ types: ['Island', 'Mountain'], basicOnly: false, entersTapped: false });
    expect(profile('Evolving Wilds').land?.fetch).toEqual({ types: [], basicOnly: true, entersTapped: true });
    expect(profile('Prismatic Vista').land?.fetch).toMatchObject({ types: [], basicOnly: true, entersTapped: false });
    // Urza's Saga cerca un artefatto, non una terra
    expect(profile("Urza's Saga").land?.fetch).toBeUndefined();
  });

  it('tratta le MDFC spell // terra come mezza terra con la magia sul fronte', () => {
    const p = profile('Shatterskull Smashing');
    expect(p.land).toMatchObject({ isMdfc: true, produces: ['R'], tapped: { kind: 'shock' } });
    expect(p.spells).toHaveLength(1);
    expect(p.spells[0]).toMatchObject({ manaCost: '{X}{R}{R}', turn: 3, pips: new Map([['R', 2]]) });
    expect(p.manaValue).toBeNull();
  });

  it('tratta le Pathway come terra a due colori', () => {
    const p = profile('Barkchannel Pathway');
    expect(p.land).toMatchObject({ isMdfc: false, produces: expect.arrayContaining(['G', 'U']) });
    expect(p.spells).toEqual([]);
  });
});

describe('magie', () => {
  it('considera entrambe le metà delle split e le avventure come alternative', () => {
    const fire = profile('Fire // Ice');
    expect(fire.spells.map((s) => [s.name, s.alternative])).toEqual([['Fire', false], ['Ice', true]]);
    expect(fire.manaValue).toBe(2);

    const giant = profile('Bonecrusher Giant');
    expect(giant.spells.map((s) => [s.name, s.turn, s.alternative])).toEqual([
      ['Bonecrusher Giant', 3, false],
      ['Stomp', 2, true],
    ]);
  });

  it('usa solo il fronte delle carte che si trasformano', () => {
    const fable = profile('Fable of the Mirror-Breaker');
    expect(fable.spells).toHaveLength(1);
    expect(fable.spells[0]).toMatchObject({ manaCost: '{2}{R}', turn: 3 });
  });

  it('gestisce ibridi e phyrexian', () => {
    expect(profile('Kitchen Finks').spells[0].pips).toEqual(new Map([['WG', 2]]));
    expect(profile('Gut Shot').spells[0].pips).toEqual(new Map());
  });
});

describe('fonti non-terra e formula delle terre', () => {
  it('conta artefatti e creature economici, non instant e sorcery', () => {
    expect(profile('Izzet Signet').nonLandSource).toMatchObject({ kind: 'rock', weight: 1, manaValue: 2 });
    expect(profile('Llanowar Elves').nonLandSource).toMatchObject({ kind: 'dork', weight: 0.5, produces: ['G'] });
    expect(profile('Deadly Dispute').nonLandSource).toBeUndefined();
    expect(profile('Dark Ritual').nonLandSource).toBeUndefined();
  });

  it('riconosce pescate e ramp economici', () => {
    for (const name of ['Opt', 'Consider', 'Expressive Iteration', 'Izzet Signet', 'Llanowar Elves', 'Thought Scour']) {
      expect(profile(name).cheapDrawOrRamp, name).toBe(true);
    }
    for (const name of ['Lightning Bolt', 'Counterspell', 'Monastery Swiftspear', 'Cryptic Command']) {
      expect(profile(name).cheapDrawOrRamp, name).toBe(false);
    }
  });

  it('riconosce il companion solo in sideboard', () => {
    expect(profile('Lurrus of the Dream-Den', 1, true).isCompanion).toBe(true);
    expect(profile('Lurrus of the Dream-Den', 1, false).isCompanion).toBe(false);
  });
});
