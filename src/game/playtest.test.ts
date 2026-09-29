import { describe, expect, it } from 'vitest';
import { buildProfiles } from '../analysis/analyze';
import { deckFrom, fixtureCards } from '../analysis/__fixtures__/load';
import {
  availableMana,
  buildCardInfo,
  cast,
  discard,
  nextTurn,
  playLand,
  putIntoPlay,
  startPlaytest,
  toggleTap,
  undo,
  type PlaytestResult,
  type PlaytestState,
} from './playtest';

const setup = (text: string) => {
  const { profiles } = buildProfiles(deckFrom(text), fixtureCards);
  const infos = new Map(profiles.map((p) => [p.name, buildCardInfo(p, profiles)]));
  return (name: string) => infos.get(name) ?? [...infos.values()].find((i) => i.name.startsWith(name));
};

let nextUid = 0;
const inst = (names: string[]) => names.map((name) => ({ uid: `${nextUid++}-${name}`, name }));
const ok = (r: PlaytestResult): PlaytestState => {
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};
const uid = (s: PlaytestState, name: string) => s.hand.find((c) => c.name === name)!.uid;

describe('prova di gioco', () => {
  const infoOf = setup('4 Lightning Bolt\n4 Counterspell\n4 Sol Ring\n4 Llanowar Elves\n4 Spikefield Hazard\n20 Mountain\n10 Island');

  it('on the play non si pesca al turno 1, nel Commander sì', () => {
    const hand = inst(['Mountain', 'Lightning Bolt']);
    const library = inst(['Island', 'Counterspell']);
    expect(startPlaytest(hand, library, { drawOnFirstTurn: false }).hand).toHaveLength(2);
    const cmd = startPlaytest(hand, library, { drawOnFirstTurn: true });
    expect(cmd.hand.map((c) => c.name)).toEqual(['Mountain', 'Lightning Bolt', 'Island']);
    expect(cmd.library).toHaveLength(1);
  });

  it('una terra per turno, poi lancio con i colori giusti', () => {
    let s = startPlaytest(inst(['Mountain', 'Island', 'Lightning Bolt', 'Counterspell']), inst(['Island', 'Mountain']), {
      drawOnFirstTurn: false,
    });
    s = ok(playLand(s, uid(s, 'Mountain'), infoOf));
    expect(playLand(s, uid(s, 'Island'), infoOf)).toEqual({ ok: false, reason: 'Hai già giocato una terra in questo turno' });
    expect(availableMana(s, infoOf)).toEqual({ total: 1, colors: ['R'] });

    // Counterspell non si paga con una Montagna
    expect(cast(s, uid(s, 'Counterspell'), infoOf).ok).toBe(false);
    s = ok(cast(s, uid(s, 'Lightning Bolt'), infoOf));
    expect(s.graveyard.map((c) => c.name)).toEqual(['Lightning Bolt']);
    expect(s.battlefield[0].tapped).toBe(true);

    s = nextTurn(s);
    expect(s.turn).toBe(2);
    expect(s.battlefield[0].tapped).toBe(false); // stappata
    expect(s.hand.map((c) => c.name)).toContain('Island'); // pescata
    s = ok(playLand(s, uid(s, 'Island'), infoOf));
    expect(cast(s, uid(s, 'Counterspell'), infoOf).ok).toBe(false); // serve UU
  });

  it('Sol Ring produce subito due mana, le creature solo dal turno dopo', () => {
    let s = startPlaytest(inst(['Mountain', 'Sol Ring', 'Llanowar Elves']), inst(['Forest', 'Forest']), { drawOnFirstTurn: false });
    s = ok(playLand(s, uid(s, 'Mountain'), infoOf));
    s = ok(cast(s, uid(s, 'Sol Ring'), infoOf));
    expect(s.battlefield.find((c) => c.name === 'Sol Ring')?.tapped).toBe(false);
    expect(availableMana(s, infoOf).total).toBe(2);

    s = ok(putIntoPlay(s, uid(s, 'Llanowar Elves'), infoOf));
    expect(availableMana(s, infoOf).total).toBe(2); // elfo appena entrato
    s = nextTurn(s);
    expect(availableMana(s, infoOf)).toEqual({ total: 4, colors: ['R', 'G', 'C'] });
  });

  it('le terre che entrano tappate non danno mana subito', () => {
    let s = startPlaytest(inst(['Spikefield Hazard']), inst(['Mountain']), { drawOnFirstTurn: false });
    s = ok(playLand(s, uid(s, 'Spikefield Hazard'), infoOf));
    expect(s.battlefield[0]).toMatchObject({ tapped: true, asLand: true });
    expect(availableMana(s, infoOf).total).toBe(0);
  });

  it('lancia il comandante dalla zona di comando', () => {
    const cmdInfo = setup('1 Krenko, Mob Boss\n20 Mountain');
    let s = startPlaytest(inst(['Mountain']), inst(['Mountain', 'Mountain', 'Mountain']), {
      drawOnFirstTurn: true,
      commanders: [{ uid: 'cmd', name: 'Krenko, Mob Boss' }],
    });
    expect(cast(s, 'cmd', cmdInfo).ok).toBe(false); // servono 4 mana
    for (let t = 0; t < 4; t++) {
      s = ok(playLand(s, s.hand.find((c) => c.name === 'Mountain')!.uid, cmdInfo));
      if (t < 3) s = nextTurn(s);
    }
    s = ok(cast(s, 'cmd', cmdInfo));
    expect(s.commandZone).toEqual([]);
    expect(s.battlefield.map((c) => c.name)).toContain('Krenko, Mob Boss');
  });

  it('scarta, tappa a mano e annulla', () => {
    let s = startPlaytest(inst(['Mountain', 'Lightning Bolt']), inst(['Island']), { drawOnFirstTurn: false });
    s = ok(discard(s, uid(s, 'Lightning Bolt')));
    expect(s.graveyard).toHaveLength(1);
    s = ok(playLand(s, uid(s, 'Mountain'), infoOf));
    s = toggleTap(s, s.battlefield[0].uid);
    expect(s.battlefield[0].tapped).toBe(true);

    s = undo(undo(s));
    expect(s.battlefield).toEqual([]);
    expect(s.landPlayed).toBe(false);
    s = undo(s);
    expect(s.hand.map((c) => c.name)).toEqual(['Mountain', 'Lightning Bolt']);
    expect(undo(s)).toBe(s); // niente da annullare
  });
});
