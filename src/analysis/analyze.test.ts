import { describe, expect, it } from 'vitest';
import { analyzeDeck, karstenLandCount } from './analyze';
import { deckFrom, fixtureCards } from './__fixtures__/load';

const BURN_SPELLS = `4 Lightning Bolt
4 Monastery Swiftspear
4 Eidolon of the Great Revel
4 Goblin Guide
4 Lava Spike
4 Rift Bolt
4 Skewer the Critics
2 Light Up the Stage
2 Searing Blood
2 Roiling Vortex`;

const analyze = (text: string) => analyzeDeck(deckFrom(text), fixtureCards);
const ids = (text: string) => analyze(text).warnings.map((w) => `${w.severity}:${w.id}`);

describe('formula delle terre', () => {
  it('applica la regressione di Karsten', () => {
    expect(karstenLandCount(2.8, 0, false)).toBeCloseTo(24.91, 2);
    expect(karstenLandCount(2, 4, true)).toBeCloseTo(19.59 + 3.8 - 1.12 + 0.27, 5);
  });
});

describe('mono rosso', () => {
  const clean = `${BURN_SPELLS}\n20 Mountain\n4 Sunbaked Canyon\n2 Den of the Bugbear`;

  it('non segnala problemi di colore in un mono rosso pulito', () => {
    const a = analyze(clean);
    expect(a.missing).toEqual([]);
    expect(a.deckSize).toBe(60);
    expect(a.colors.map((c) => c.key)).toEqual(['R']);
    expect(a.colors[0].ok).toBe(true);
    expect(a.warnings.filter((w) => w.id.startsWith('color-') || w.id.startsWith('off-color'))).toEqual([]);
  });

  it('segnala 26 terre come troppe per un burn con costo medio basso', () => {
    const a = analyze(clean);
    expect(a.landCount.averageManaValue).toBeCloseTo(1.82, 2);
    expect(a.landCount.recommended).toBeCloseTo(23.05, 1);
    expect(a.warnings.find((w) => w.id === 'land-count')).toMatchObject({ severity: 'warning' });
  });

  it("segnala l'Isola in un mazzo mono rosso e l'optimizer la sostituisce", () => {
    const a = analyze(`${BURN_SPELLS}\n19 Mountain\n1 Island\n4 Sunbaked Canyon\n2 Den of the Bugbear`);
    const island = a.warnings.find((w) => w.id === 'off-color-Island');
    expect(island).toMatchObject({ severity: 'warning' });
    expect(island!.title).toContain('blu');

    expect(a.optimizer!.changes).toEqual(
      expect.arrayContaining([
        { name: 'Island', from: 1, to: 0 },
        { name: 'Mountain', from: 19, to: 20 },
      ]),
    );
  });
});

describe('Izzet', () => {
  const IZZET_SPELLS = `4 Counterspell
4 Expressive Iteration
4 Consider
4 Lightning Bolt
4 Murktide Regent
4 Dragon's Rage Channeler
4 Ragavan, Nimble Pilferer
4 Unholy Heat
4 Thought Scour
2 Cryptic Command`;

  it('dà errore se ci sono solo 2 fonti di blu', () => {
    const a = analyze(`${IZZET_SPELLS}\n2 Island\n16 Mountain`);
    const blue = a.warnings.find((w) => w.id === 'color-U');
    expect(blue).toMatchObject({ severity: 'error' });
    expect(blue!.title).toMatch(/^Blu: 2 fonti\. (Counterspell|Cryptic Command)/);

    // L'optimizer ridistribuisce le base a favore del blu
    const blueAfter = a.optimizer!.sources.find((s) => s.key === 'U')!;
    expect(blueAfter.before).toBe(2);
    expect(blueAfter.after).toBeGreaterThanOrEqual(8);
    expect(a.optimizer!.after.deficit).toBeLessThan(a.optimizer!.before.deficit);
  });

  it('conta fetch e dual come fonti di entrambi i colori', () => {
    const a = analyze(`${IZZET_SPELLS}\n4 Steam Vents\n4 Spirebluff Canal\n4 Scalding Tarn\n2 Sulfur Falls\n3 Island\n1 Mountain`);
    const blue = a.colors.find((c) => c.key === 'U')!;
    const red = a.colors.find((c) => c.key === 'R')!;
    expect(blue.landSources).toBe(17);
    expect(red.landSources).toBe(15);
  });

  it('non conta una fetch che non può cercare nessuna terra del mazzo', () => {
    const a = analyze(`${IZZET_SPELLS}\n4 Arid Mesa\n10 Island\n4 Mountain`);
    const red = a.colors.find((c) => c.key === 'R')!;
    // Arid Mesa cerca Mountain o Plains: con i Mountain presenti conta come rosso, non come blu
    expect(red.landSources).toBe(8);
    expect(a.colors.find((c) => c.key === 'U')!.landSources).toBe(10);

    const noMountain = analyze(`4 Counterspell\n4 Arid Mesa\n16 Island`);
    expect(noMountain.colors.find((c) => c.key === 'U')!.landSources).toBe(16);
    expect(noMountain.warnings.find((w) => w.id === 'colorless')?.cards).toContain('Arid Mesa');
  });
});

describe('fonti non-terra', () => {
  it('Izzet Signet aiuta le carte da 3+ ma non quelle da 2', () => {
    const a = analyze(`4 Counterspell\n4 Cryptic Command\n4 Izzet Signet\n12 Island\n10 Mountain`);
    const blue = a.colors.find((c) => c.key === 'U')!;
    const counterspell = blue.checks.find((c) => c.card === 'Counterspell')!;
    const cryptic = blue.checks.find((c) => c.card === 'Cryptic Command')!;
    expect(counterspell.sources.support).toBe(0);
    expect(cryptic.sources.support).toBe(4);
    expect(a.warnings.find((w) => w.id === 'support-sources')).toBeDefined();
  });
});

describe('mano iniziale', () => {
  it('calcola probabilità coerenti', () => {
    const a = analyze(`36 Lightning Bolt\n24 Mountain`);
    expect(a.openingHand.distribution[0]).toBeCloseTo(0.0216, 3);
    expect(a.openingHand.keepable + a.openingHand.screw + a.openingHand.flood).toBeCloseTo(1, 10);
    expect(a.openingHand.landDrops[2].play).toBeCloseTo(0.7887, 3);
    expect(a.openingHand.landDrops[2].draw).toBeGreaterThan(a.openingHand.landDrops[2].play);
  });

  it('segnala un mazzo con poche terre', () => {
    expect(ids(`45 Lightning Bolt\n15 Mountain`)).toContain('warning:screw');
  });
});

describe('robustezza', () => {
  it('segnala carte non trovate e mazzi troppo piccoli', () => {
    const w = ids(`4 Lightning Blot\n20 Mountain`);
    expect(w).toContain('warning:missing-cards');
    expect(w).toContain('error:deck-size');
  });

  it('gestisce un mazzo senza terre', () => {
    expect(ids(`60 Lightning Bolt`)).toContain('error:no-lands');
  });
});

describe('optimizer', () => {
  it('non propone modifiche se la mana base soddisfa già tutto', () => {
    const a = analyze(
      `4 Counterspell\n4 Expressive Iteration\n4 Consider\n4 Opt\n4 Lightning Bolt\n4 Murktide Regent\n4 Dragon's Rage Channeler\n4 Ragavan, Nimble Pilferer\n4 Unholy Heat\n4 Thought Scour\n2 Cryptic Command\n4 Steam Vents\n4 Spirebluff Canal\n4 Scalding Tarn\n2 Sulfur Falls\n3 Island\n1 Mountain`,
    );
    expect(a.deckSize).toBe(60);
    expect(a.colors.every((c) => c.ok)).toBe(true);
    expect(a.optimizer!.changes).toEqual([]);
    expect(a.optimizer!.feasible).toBe(true);
  });

  it('segnala quando servono terre doppie', () => {
    const a = analyze(`8 Counterspell\n8 Lightning Bolt\n4 Cryptic Command\n4 Murktide Regent\n16 Consider\n2 Island\n18 Mountain`);
    expect(a.optimizer!.feasible).toBe(false);
  });
});

describe('Mono U Terror (Pauper)', () => {
  const TERROR = `16 Island
4 Delver of Secrets
4 Tolarian Terror
4 Cryptic Serpent
4 Brainstorm
3 Ponder
4 Thought Scour
4 Mental Note
4 Counterspell
4 Lorien Revealed
3 Force Spike
3 Deem Inferior
2 Sleep of the Dead
1 Plunder the Trollshaws`;

  it('conta Lórien Revealed come mezza terra e i costi ridotti al valore effettivo', () => {
    const a = analyze(TERROR);
    expect(a.lands).toMatchObject({ weighted: 18, playable: 20, landcyclers: 4 });
    expect(a.landCount.averageManaValue).toBeCloseTo(1.5, 2);
    expect(a.landCount.recommended).toBeCloseTo(17.96, 1);
    expect(a.landCount.costReduced.map((c) => c.name)).toEqual(['Tolarian Terror', 'Cryptic Serpent', 'Deem Inferior']);
    expect(a.warnings.find((w) => w.id === 'land-count')).toBeUndefined();
    // la varianza della mano iniziale è solo informativa
    expect(a.warnings.find((w) => w.id === 'screw')?.severity).toBe('info');
  });

  it('i landcycler sono fonti di blu dal turno 2', () => {
    const a = analyze(TERROR);
    const blue = a.colors.find((c) => c.key === 'U')!;
    expect(blue.landSources).toBe(18);
    const delver = blue.checks.find((c) => c.card.startsWith('Delver'))!;
    const counterspell = blue.checks.find((c) => c.card === 'Counterspell')!;
    expect(delver.sources.lands).toBe(16);
    expect(counterspell.sources.lands).toBe(18);
    expect(a.optimizer!.changes).toEqual([]);
  });
});

describe('carte giocabili solo in modo alternativo', () => {
  const MONO_RED = `3 Faithless Looting
4 Fiery Temper
3 Fireblast
4 Grab the Prize
3 Guttersnipe
4 Highway Robbery
4 Kessig Flamebreather
4 Lava Dart
4 Lightning Bolt
18 Mountain
1 Sazacap's Brew
4 Sneaky Snacker
4 Voldaren Epicure`;

  it('Sneaky Snacker in mono rosso: avviso informativo, nessun errore di colore', () => {
    const a = analyze(MONO_RED);
    expect(a.altOnly).toEqual([
      { card: 'Sneaky Snacker', manaCost: '{U}{B}', missing: ['U', 'B'], alternatives: ['può tornare in gioco dal cimitero'] },
    ]);
    const info = a.warnings.find((w) => w.id === 'alt-only-Sneaky Snacker')!;
    expect(info.severity).toBe('info');
    expect(info.title).toBe('Sneaky Snacker ({U}{B}): non puoi lanciarla dalla mano');
    expect(a.warnings.filter((w) => w.severity === 'error')).toEqual([]);
    expect(a.colors.map((c) => c.key)).toEqual(['R']);
    // l'optimizer non propone Isole o Paludi
    expect(a.optimizer!.changes).toEqual([]);
  });

  it('esclude dal costo medio le carte che non chiedono terre', () => {
    const a = analyze(MONO_RED);
    expect(a.landCount.excludedFromAverage).toEqual([
      { name: 'Fireblast', quantity: 3, reason: 'costo alternativo senza mana' },
      { name: 'Sneaky Snacker', quantity: 4, reason: 'non si lancia dalla mano' },
    ]);
    // Lava Dart ha un flashback senza mana, ma dal cimitero: resta nel costo medio
    expect(a.landCount.excludedFromAverage.map((c) => c.name)).not.toContain('Lava Dart');
    // con Fiery Temper al costo di Madness: (62.2 - 4 × 2) / 35
    expect(a.landCount.averageManaValue).toBeCloseTo(54.2 / 35, 1);
  });

  it('con abbastanza modi per scartare Fiery Temper usa il costo di Madness', () => {
    const a = analyze(MONO_RED);
    expect(a.landCount.discardOutlets).toBe(16);
    expect(a.landCount.costReduced).toContainEqual({ name: 'Fiery Temper', quantity: 4, printed: 3, effective: 1, via: 'Madness' });
    const temper = a.colors[0].checks.find((c) => c.card === 'Fiery Temper')!;
    expect(temper).toMatchObject({ manaCost: '{R}', turn: 1, pips: 1 });
    expect(a.landCount.recommended).toBeCloseTo(19.17, 1);
  });

  it('senza modi per scartare Fiery Temper resta a costo pieno', () => {
    const a = analyze(`4 Fiery Temper\n4 Faithless Looting\n32 Lightning Bolt\n20 Mountain`);
    expect(a.landCount.discardOutlets).toBe(4);
    expect(a.landCount.costReduced).toEqual([]);
    expect(a.colors[0].checks.find((c) => c.card === 'Fiery Temper')).toMatchObject({ manaCost: '{1}{R}{R}', turn: 3 });
  });

  it('senza alternative percorribili resta l\'errore', () => {
    // Kroxa ha Escape, ma serve comunque il nero
    const a = analyze(`4 Kroxa, Titan of Death's Hunger\n36 Lightning Bolt\n20 Mountain`);
    expect(a.altOnly).toEqual([]);
    expect(a.warnings.find((w) => w.id === 'color-B')).toMatchObject({ severity: 'error' });
  });

  it('una carta con qualche fonte del suo colore resta un requisito normale', () => {
    const a = analyze(`4 Sneaky Snacker\n36 Lightning Bolt\n2 Island\n2 Swamp\n16 Mountain`);
    expect(a.altOnly).toEqual([]);
    expect(a.colors.map((c) => c.key).sort()).toEqual(['B', 'R', 'U']);
  });
});

describe('creature da rianimare', () => {
  const ATRAXA = `4 Sheoldred's Restoration
4 Atraxa, Grand Unifier
4 Fable of the Mirror-Breaker
4 Go for the Throat
4 Scrapwork Mutt
4 Evangel of Synthesis
4 Bloodtithe Harvester
4 Tainted Indulgence
3 Tyrranax Rex
2 Graveyard Shift
4 Xander's Lounge
4 Shipwreck Marsh
4 Haunted Ridge
1 Swamp
3 Darkslick Shores
2 Blackcleave Cliffs
2 Sulfurous Springs
2 Underground River
1 Stormcarved Coast`;

  it('Atraxa e Tyrranax Rex senza fonti ma rianimabili: avviso informativo, nessun errore', () => {
    const a = analyze(ATRAXA);
    expect(a.altOnly.map((c) => [c.card, c.alternatives])).toEqual([
      ['Atraxa, Grand Unifier', ["può essere rianimata con Sheoldred's Restoration, Graveyard Shift"]],
      ['Tyrranax Rex', ["può essere rianimata con Sheoldred's Restoration, Graveyard Shift"]],
    ]);
    expect(a.warnings.filter((w) => w.severity === 'error')).toEqual([]);
    expect(a.colors.map((c) => c.key).sort()).toEqual(['B', 'R', 'U']);
    // non si lanciano mai: fuori dal costo medio
    expect(a.landCount.excludedFromAverage.map((c) => c.name)).toEqual(['Atraxa, Grand Unifier', 'Tyrranax Rex']);
  });

  it('rispetta le restrizioni: Persist non rianima creature leggendarie, Unearth solo costo ≤ 3', () => {
    const base = `4 Atraxa, Grand Unifier\n32 Go for the Throat\n24 Swamp`;
    expect(analyze(`${base}\n4 Persist`).altOnly).toEqual([]);
    expect(analyze(`${base}\n4 Unearth`).altOnly).toEqual([]);
    expect(analyze(`${base}\n4 Reanimate`).altOnly.map((c) => c.card)).toEqual(['Atraxa, Grand Unifier']);
  });

  it('la magia che rianima deve essere lanciabile', () => {
    // Reanimate è nero, ma il mazzo ha solo Montagne: Atraxa resta un errore
    const a = analyze(`4 Atraxa, Grand Unifier\n4 Reanimate\n28 Lightning Bolt\n24 Mountain`);
    expect(a.altOnly).toEqual([]);
    expect(a.warnings.some((w) => w.severity === 'error' && w.cards?.includes('Atraxa, Grand Unifier'))).toBe(true);
  });
});
