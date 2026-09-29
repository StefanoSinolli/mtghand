/**
 * Simulazione Monte Carlo dei primi turni (on the play; nel Commander si pesca al T1):
 * mulligan London con la strategia di Karsten, una terra per turno, terre tappate e condizionali.
 * Misura la probabilità di poter lanciare ogni magia nel turno pari al suo costo.
 * Le fonti non-terra non sono considerate: la simulazione valuta solo le terre.
 */

import type { BasicType, CardProfile, Landcycling, TappedRule } from './cardProfile';
import { landColors } from './manaBase';
import { keyColors, type ManaSymbolColor } from './manaCost';
import { shuffle } from '../utils/shuffle';
import { mulliganSteps, spellsToBottom } from '../game/mulliganStrategy';

export interface SimulationOptions {
  games?: number;
  maxTurn?: number;
  /** false = si pesca anche al primo turno (Commander multiplayer) */
  onThePlay?: boolean;
  /** Il primo mulligan è gratuito (Commander multiplayer) */
  freeFirstMulligan?: boolean;
  random?: () => number;
  /** Carte da non misurare (giocabili solo in modo alternativo) */
  excludeCards?: string[];
  /** Comandanti: sempre disponibili, se ne misura il lancio in curva */
  commanders?: CardProfile[];
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
  /** Frequenza del numero di mulligan, indice = mulligan fatti (incluso quello gratuito) */
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
  isBasic: boolean;
  isMdfc: boolean;
}

interface SimCard {
  land?: SimLand;
  /** Landcycling: costo e terre che può cercare */
  cycler?: Landcycling;
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
          isBasic: p.land.isBasic,
          isMdfc: p.land.isMdfc,
        }
      : undefined;
    const manaValue = p.spells[0]?.manaValue ?? 0;
    for (let i = 0; i < p.quantity; i++) cards.push({ land, cycler: p.landcycling, manaValue });
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

/** Le carte con landcycling contano come terre nel decidere mulligan e fondo */
const isLandish = (c: SimCard) => c.land !== undefined || c.cycler !== undefined;

/** Indice nel mazzo della prima terra che il landcycling può trovare */
const findCycleTarget = (deck: SimCard[], from: number, cycler: Landcycling) =>
  deck.findIndex(
    (c, i) =>
      i >= from &&
      c.land !== undefined &&
      !c.land.isMdfc &&
      (!cycler.basicOnly || c.land.isBasic) &&
      (cycler.types.length === 0 || c.land.basicTypes.some((t) => cycler.types.includes(t))),
  );

/**
 * Mette in fondo `count` carte secondo la strategia di Karsten: prima le magie più costose
 * (quante ne dice spellsToBottom), poi le terre che producono meno colori
 */
const bottom = (hand: SimCard[], count: number) => {
  const spells = hand.filter((c) => !isLandish(c)).sort((a, b) => b.manaValue - a.manaValue);
  const lands = hand.filter(isLandish).sort((a, b) => (a.land?.colors.length ?? 0) - (b.land?.colors.length ?? 0));
  const spellCount = spellsToBottom(spells.length, count);
  const out = new Set([...spells.slice(0, spellCount), ...lands.slice(0, count - spellCount)]);
  return hand.filter((c) => !out.has(c));
};

export interface MulliganOutcome<T> {
  hand: T[];
  /** Resto del mazzo, carte in fondo escluse */
  library: T[];
  mulligans: number;
}

/**
 * Risolve il mulligan con la strategia di Karsten (vedi mulliganStrategy.ts).
 * Le carte messe in fondo non si pescano nei primi turni: restano fuori da `library`.
 */
export const resolveMulligan = <T extends SimCard>(
  cards: T[],
  random: () => number,
  freeFirstMulligan: boolean,
): MulliganOutcome<T> => {
  const steps = mulliganSteps(freeFirstMulligan);
  for (let i = 0; ; i++) {
    const shuffled = shuffle(cards, random);
    const step = steps[i];
    const hand = bottom(shuffled.slice(0, 7), 7 - step.handSize) as T[];
    const lands = hand.filter(isLandish).length;
    if (i === steps.length - 1 || (lands >= step.minLands && lands <= step.maxLands)) {
      return { hand, library: shuffled.slice(7), mulligans: i };
    }
  }
};

export const simulate = (profiles: CardProfile[], options: SimulationOptions = {}): SimulationResult => {
  const {
    games = 10000,
    maxTurn = 6,
    onThePlay = true,
    freeFirstMulligan = false,
    random = Math.random,
    excludeCards = [],
    commanders = [],
  } = options;

  const library = buildLibrary(profiles);
  const checks = [...faceChecks(commanders, maxTurn), ...faceChecks(profiles, maxTurn)].filter(
    (c) => !excludeCards.includes(c.card),
  );
  const mulligans = new Array<number>(mulliganSteps(freeFirstMulligan).length).fill(0);
  const landDrops = new Array<number>(maxTurn).fill(0);
  const untappedDrops = new Array<number>(maxTurn).fill(0);
  const castable = new Array<number>(checks.length).fill(0);
  const withLands = new Array<number>(checks.length).fill(0);

  if (library.length < 7) {
    return { games: 0, mulligans, landDrops, untappedLandDrops: untappedDrops, casts: [] };
  }

  for (let g = 0; g < games; g++) {
    const { hand, library: deck, mulligans: mulls } = resolveMulligan(library, random, freeFirstMulligan);
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

      const playLand = (land: SimLand) => {
        const tapped = entersTapped(land, battlefield);
        battlefield.push({ colors: land.colors, basicTypes: land.basicTypes, usableFrom: tapped ? turn + 1 : turn });
      };

      // Mana speso questo turno per ciclare
      let spent = 0;

      if (bestIndex >= 0) {
        playLand(hand[bestIndex].land!);
        hand.splice(bestIndex, 1);
      } else {
        // Nessuna terra in mano: cicla un landcycler (se c'è il mana) e gioca la terra trovata
        const usableNow = battlefield.filter((l) => l.usableFrom <= turn).length;
        const cyclerIndex = hand.findIndex((c) => c.cycler && c.cycler.cost <= usableNow);
        if (cyclerIndex >= 0) {
          const cycler = hand[cyclerIndex].cycler!;
          hand.splice(cyclerIndex, 1);
          spent += cycler.cost;
          const target = findCycleTarget(deck, drawIndex, cycler);
          if (target >= 0) {
            playLand(deck[target].land!);
            deck.splice(target, 1);
          }
        }
      }

      const usable = battlefield.filter((l) => l.usableFrom <= turn);
      const available = usable.length - spent;
      if (battlefield.length >= turn) landDrops[turn - 1]++;
      if (available >= turn) untappedDrops[turn - 1]++;

      checks.forEach((check, i) => {
        if (check.turn !== turn || available < turn) return;
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
