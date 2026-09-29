/**
 * Simulazione Monte Carlo dei primi turni (on the play):
 * mulligan London, una terra per turno, terre tappate e condizionali.
 * Misura la probabilità di poter lanciare ogni magia nel turno pari al suo costo.
 * Le fonti non-terra non sono considerate: la simulazione valuta solo le terre.
 */

import type { BasicType, CardProfile, TappedRule } from './cardProfile';
import { landColors } from './manaBase';
import { keyColors, type ManaSymbolColor } from './manaCost';
import { shuffle } from '../utils/shuffle';

export interface SimulationOptions {
  games?: number;
  maxTurn?: number;
  onThePlay?: boolean;
  random?: () => number;
}

export interface CastStat {
  card: string;
  face: string;
  manaCost: string;
  turn: number;
  /** P(lanciabile al turno = costo), indipendentemente dall'averla pescata */
  onCurve: number;
  /** Come sopra, ma solo nelle partite con abbastanza terre (misura del colore) */
  onCurveGivenLands: number;
}

export interface SimulationResult {
  games: number;
  /** Frequenza del numero di mulligan, indice = mulligan (0..3) */
  mulligans: number[];
  /** P(almeno t terre in gioco al turno t), indice 0 = turno 1 */
  landDrops: number[];
  /** P(almeno t terre utilizzabili — non tappate — al turno t) */
  untappedLandDrops: number[];
  casts: CastStat[];
}

interface SimLand {
  colors: ManaSymbolColor[];
  tapped: TappedRule;
  fetchTapped: boolean;
  basicTypes: BasicType[];
  isMdfc: boolean;
}

interface SimCard {
  land?: SimLand;
  manaValue: number;
}

interface BattlefieldLand {
  colors: ManaSymbolColor[];
  basicTypes: BasicType[];
  usableFrom: number;
}

interface FaceCheck {
  card: string;
  face: string;
  manaCost: string;
  turn: number;
  /** Per ogni simbolo colorato, i colori che lo pagano */
  pips: ManaSymbolColor[][];
}

const MAX_MULLIGANS = 3;

const entersTapped = (land: SimLand, battlefield: BattlefieldLand[]) => {
  if (land.fetchTapped) return true;
  const rule = land.tapped;
  switch (rule.kind) {
    case 'never':
    case 'shock': // si paga la vita
    case 'conditional': // ipotesi ottimistica
      return false;
    case 'always':
      return true;
    case 'fast':
      return battlefield.length > 2;
    case 'slow':
      return battlefield.length >= 2;
    case 'check':
      return !battlefield.some((l) => l.basicTypes.some((t) => rule.types.includes(t)));
  }
};

/** Verifica se i simboli colorati possono essere pagati con terre distinte (matching bipartito) */
const canPay = (pips: ManaSymbolColor[][], lands: BattlefieldLand[]) => {
  const owner = new Array<number>(lands.length).fill(-1);

  const assign = (pip: number, seen: boolean[]): boolean => {
    for (let l = 0; l < lands.length; l++) {
      if (seen[l] || !pips[pip].some((c) => lands[l].colors.includes(c))) continue;
      seen[l] = true;
      if (owner[l] === -1 || assign(owner[l], seen)) {
        owner[l] = pip;
        return true;
      }
    }
    return false;
  };

  return pips.every((_, pip) => assign(pip, new Array<boolean>(lands.length).fill(false)));
};

const buildLibrary = (profiles: CardProfile[]): SimCard[] => {
  const cards: SimCard[] = [];
  for (const p of profiles) {
    const land: SimLand | undefined = p.land
      ? {
          colors: [...landColors(p.land, profiles)],
          tapped: p.land.tapped,
          fetchTapped: p.land.fetch?.entersTapped ?? false,
          basicTypes: p.land.basicTypes,
          isMdfc: p.land.isMdfc,
        }
      : undefined;
    const manaValue = p.spells[0]?.manaValue ?? 0;
    for (let i = 0; i < p.quantity; i++) cards.push({ land, manaValue });
  }
  return cards;
};

const faceChecks = (profiles: CardProfile[], maxTurn: number): FaceCheck[] =>
  profiles.flatMap((p) =>
    p.spells
      .filter((s) => !s.alternative && s.turn <= maxTurn && s.pips.size > 0)
      .map((s) => ({
        card: p.name,
        face: s.name,
        manaCost: s.manaCost,
        turn: s.turn,
        pips: [...s.pips].flatMap(([key, n]) => Array.from({ length: n }, () => keyColors(key))),
      })),
  );

/** Terre desiderate in una mano di `size` carte */
const idealLands = (size: number) => Math.max(2, Math.round(size * 0.43));

const keepable = (hand: SimCard[], size: number) => {
  const lands = hand.filter((c) => c.land).length;
  if (size >= 7) return lands >= 2 && lands <= 5;
  if (size === 6) return lands >= 2 && lands <= 4;
  if (size === 5) return lands >= 1 && lands <= 4;
  return true;
};

/** Sceglie le carte da mettere in fondo: terre in eccesso o magie più costose */
const bottom = (hand: SimCard[], count: number) => {
  const kept = [...hand];
  const target = idealLands(hand.length - count);
  for (let i = 0; i < count; i++) {
    const lands = kept.filter((c) => c.land).length;
    let index: number;
    if (lands > target) {
      index = kept.findIndex((c) => c.land);
    } else {
      index = kept.reduce(
        (best, c, j) => (!c.land && (best === -1 || c.manaValue > kept[best].manaValue) ? j : best),
        -1,
      );
      if (index === -1) index = kept.findIndex((c) => c.land);
    }
    kept.splice(index, 1);
  }
  return kept;
};

export const simulate = (profiles: CardProfile[], options: SimulationOptions = {}): SimulationResult => {
  const { games = 10000, maxTurn = 6, onThePlay = true, random = Math.random } = options;

  const library = buildLibrary(profiles);
  const checks = faceChecks(profiles, maxTurn);
  const mulligans = new Array<number>(MAX_MULLIGANS + 1).fill(0);
  const landDrops = new Array<number>(maxTurn).fill(0);
  const untappedDrops = new Array<number>(maxTurn).fill(0);
  const castable = new Array<number>(checks.length).fill(0);
  const withLands = new Array<number>(checks.length).fill(0);

  if (library.length < 7) {
    return { games: 0, mulligans, landDrops, untappedLandDrops: untappedDrops, casts: [] };
  }

  for (let g = 0; g < games; g++) {
    // --- Mulligan ---
    let deck: SimCard[] = [];
    let hand: SimCard[] = [];
    let mulls = 0;
    for (;;) {
      deck = shuffle(library, random);
      hand = deck.slice(0, 7);
      const size = 7 - mulls;
      if (mulls >= MAX_MULLIGANS || keepable(bottom(hand, mulls), size)) {
        hand = bottom(hand, mulls);
        deck = deck.slice(7);
        break;
      }
      mulls++;
    }
    mulligans[mulls]++;

    // --- Turni ---
    const battlefield: BattlefieldLand[] = [];
    let drawIndex = 0;

    for (let turn = 1; turn <= maxTurn; turn++) {
      if (turn > 1 || !onThePlay) {
        if (drawIndex < deck.length) hand.push(deck[drawIndex++]);
      }

      // Scelta della terra: nuovi colori, poi stappata, le MDFC solo se servono
      const present = new Set(battlefield.flatMap((l) => l.colors));
      let bestIndex = -1;
      let bestScore = -Infinity;
      hand.forEach((c, i) => {
        if (!c.land) return;
        const newColors = c.land.colors.filter((col) => !present.has(col)).length;
        const tapped = entersTapped(c.land, battlefield);
        const score = newColors * 10 - (tapped && turn > 1 ? 3 : 0) - (c.land.isMdfc ? 8 : 0);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      });

      if (bestIndex >= 0) {
        const land = hand[bestIndex].land!;
        const tapped = entersTapped(land, battlefield);
        battlefield.push({ colors: land.colors, basicTypes: land.basicTypes, usableFrom: tapped ? turn + 1 : turn });
        hand.splice(bestIndex, 1);
      }

      const usable = battlefield.filter((l) => l.usableFrom <= turn);
      if (battlefield.length >= turn) landDrops[turn - 1]++;
      if (usable.length >= turn) untappedDrops[turn - 1]++;

      checks.forEach((check, i) => {
        if (check.turn !== turn || usable.length < turn) return;
        withLands[i]++;
        if (canPay(check.pips, usable)) castable[i]++;
      });
    }
  }

  return {
    games,
    mulligans: mulligans.map((m) => m / games),
    landDrops: landDrops.map((d) => d / games),
    untappedLandDrops: untappedDrops.map((d) => d / games),
    casts: checks.map((c, i) => ({
      card: c.card,
      face: c.face,
      manaCost: c.manaCost,
      turn: c.turn,
      onCurve: castable[i] / games,
      onCurveGivenLands: withLands[i] > 0 ? castable[i] / withLands[i] : 0,
    })),
  };
};
