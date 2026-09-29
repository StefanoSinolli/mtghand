import { mulliganSteps, spellsToBottom } from '../game/mulliganStrategy';

/**
 * Probabilità ipergeometriche e modello di Frank Karsten per le fonti colorate.
 *
 * Karsten (2022): una carta di valore di mana T con P simboli di un colore è "consistente" se,
 * avendo pescato almeno T terre entro il turno T, la probabilità di avere almeno P fonti
 * di quel colore è ≥ (89 + T)% (90% per un 1-drop, fino al 96% per un 7-drop).
 * Modello: on the play (Commander: pescata al turno 1 e primo mulligan gratuito), London
 * mulligan con la sua strategia. Riproduce le tabelle pubblicate per 40, 60 e 99 carte.
 */

const logFactCache: number[] = [0];

const logFactorial = (n: number): number => {
  for (let i = logFactCache.length; i <= n; i++) {
    logFactCache[i] = logFactCache[i - 1] + Math.log(i);
  }
  return logFactCache[n];
};

const logComb = (n: number, k: number) =>
  k < 0 || k > n ? -Infinity : logFactorial(n) - logFactorial(k) - logFactorial(n - k);

/** Numero di combinazioni C(n, k) (in floating point) */
export const comb = (n: number, k: number) => (k < 0 || k > n ? 0 : Math.exp(logComb(n, k)));

/** P(esattamente k successi pescando n carte da N che ne contengono K) */
export const hypergeometric = (N: number, K: number, n: number, k: number) => {
  if (k < 0 || k > n || k > K || n - k > N - K) return 0;
  return Math.exp(logComb(K, k) + logComb(N - K, n - k) - logComb(N, n));
};

/** P(almeno k successi) */
export const hypergeometricAtLeast = (N: number, K: number, n: number, k: number) => {
  let p = 0;
  for (let i = Math.max(0, k); i <= Math.min(n, K); i++) p += hypergeometric(N, K, n, i);
  return Math.min(1, p);
};

/** Distribuzione del numero di terre nella mano iniziale (indice = numero di terre) */
export const openingHandLandDistribution = (deckSize: number, lands: number, handSize = 7) =>
  Array.from({ length: handSize + 1 }, (_, k) => hypergeometric(deckSize, lands, handSize, k));

/**
 * P(avere pescato almeno `turn` terre entro il turno `turn`)
 * on the play si pescano 7 + (turn - 1) carte, on the draw una in più
 */
export const landDropProbability = (deckSize: number, lands: number, turn: number, onThePlay = true) =>
  hypergeometricAtLeast(deckSize, lands, 7 + turn - (onThePlay ? 1 : 0), turn);

// --- Modello Karsten -----------------------------------------------------------

export interface ManaModel {
  /** Commander multiplayer: il primo mulligan è gratuito */
  freeFirstMulligan: boolean;
  /** Commander multiplayer: si pesca anche al primo turno */
  drawOnFirstTurn: boolean;
}

export const CONSTRUCTED_MODEL: ManaModel = { freeFirstMulligan: false, drawOnFirstTurn: false };

/** Soglia di consistenza per un valore di mana: (89 + T)%, T limitato a 1..7 */
export const consistencyTarget = (turn: number) => (89 + Math.min(7, Math.max(1, turn))) / 100;

/** P(esattamente s fonti, o altre terre, x magie in una pescata da S/O/X) */
const logMultiHyper = (S: number, O: number, X: number, s: number, o: number, x: number) =>
  logComb(S, s) + logComb(O, o) + logComb(X, x) - logComb(S + O + X, s + o + x);

/**
 * Modello di Karsten: P(≥ pips fonti del colore | ≥ turn terre) entro il turno `turn`, on the play,
 * con mulligan London secondo la sua strategia (vedi mulliganStrategy.ts). Calcolo esatto:
 * per ogni mulligan si enumerano le mani da 7 (fonti, altre terre, magie), si applica il fondo
 * e si pescano le carte successive dal resto del mazzo.
 * Riproduce le tabelle pubblicate (60/25, 99/41 Commander, 40/17) valore per valore.
 */
export const castOnCurveProbability = (
  deckSize: number,
  lands: number,
  sources: number,
  turn: number,
  pips: number,
  model: ManaModel = CONSTRUCTED_MODEL,
): number => {
  const S = Math.min(sources, lands);
  const O = lands - S; // terre che non producono il colore
  const X = deckSize - lands;
  const draws = turn - 1 + (model.drawOnFirstTurn ? 1 : 0);

  let num = 0;
  let den = 0;
  let reach = 1; // probabilità di arrivare a questo mulligan

  for (const step of mulliganSteps(model.freeFirstMulligan)) {
    const toBottom = 7 - step.handSize;
    let mulligan = 0;

    for (let s = 0; s <= Math.min(S, 7); s++) {
      for (let o = 0; o <= Math.min(O, 7 - s); o++) {
        const x = 7 - s - o;
        if (x > X) continue;
        const pHand = Math.exp(logMultiHyper(S, O, X, s, o, x));

        // fondo: prima le magie secondo la strategia, poi le terre del colore sbagliato
        const bottomSpells = spellsToBottom(x, toBottom);
        const bottomLands = toBottom - bottomSpells;
        const bottomOff = Math.min(o, bottomLands);
        const ks = s - (bottomLands - bottomOff);
        const ko = o - bottomOff;

        if (ks + ko < step.minLands || ks + ko > step.maxLands) {
          mulligan += pHand;
          continue;
        }

        // pescate successive dalle carte non viste (quelle in fondo restano in fondo)
        const S2 = S - s;
        const O2 = O - o;
        const X2 = X - x;
        for (let s2 = 0; s2 <= Math.min(S2, draws); s2++) {
          for (let o2 = 0; o2 <= Math.min(O2, draws - s2); o2++) {
            const x2 = draws - s2 - o2;
            if (x2 > X2) continue;
            if (ks + ko + s2 + o2 < turn) continue;
            const p = reach * pHand * Math.exp(logMultiHyper(S2, O2, X2, s2, o2, x2));
            den += p;
            if (ks + s2 >= pips) num += p;
          }
        }
      }
    }

    reach *= mulligan;
  }

  return den === 0 ? 0 : num / den;
};

const requiredCache = new Map<string, number | null>();

/**
 * Numero minimo di fonti di un colore per lanciare in curva una carta di valore
 * di mana `turn` con `pips` simboli di quel colore.
 * Restituisce null se anche con tutte le terre come fonti non si raggiunge la soglia.
 */
export const requiredSources = (
  deckSize: number,
  lands: number,
  turn: number,
  pips: number,
  model: ManaModel = CONSTRUCTED_MODEL,
): number | null => {
  const t = Math.min(7, Math.max(1, turn));
  const key = `${deckSize}:${lands}:${t}:${pips}:${model.freeFirstMulligan}:${model.drawOnFirstTurn}`;
  if (requiredCache.has(key)) return requiredCache.get(key)!;

  const target = consistencyTarget(t);
  const ok = (s: number) => castOnCurveProbability(deckSize, lands, s, t, pips, model) >= target;

  // la probabilità cresce con le fonti: ricerca binaria
  let result: number | null = null;
  if (pips <= lands && ok(lands)) {
    let lo = pips;
    let hi = lands;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (ok(mid)) hi = mid;
      else lo = mid + 1;
    }
    result = lo;
  }

  requiredCache.set(key, result);
  return result;
};
