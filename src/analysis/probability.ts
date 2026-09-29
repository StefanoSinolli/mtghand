/**
 * Probabilità ipergeometriche e modello di Frank Karsten per le fonti colorate.
 *
 * Karsten (2022): una carta di valore di mana T con P simboli di un colore è "consistente" se,
 * avendo pescato almeno T terre entro il turno T, la probabilità di avere almeno P fonti
 * di quel colore è ≥ (89 + T)% (90% per un 1-drop, fino al 96% per un 7-drop).
 * Modello: on the play, mano da 7 tenuta solo con 2–5 terre (approssima il London mulligan).
 * Con 25 terre su 60 riproduce la tabella pubblicata con scarti di al più una fonte.
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

const KEEP_MIN_LANDS = 2;
const KEEP_MAX_LANDS = 5;

/** Soglia di consistenza per un valore di mana: (89 + T)%, T limitato a 1..7 */
export const consistencyTarget = (turn: number) => (89 + Math.min(7, Math.max(1, turn))) / 100;

/**
 * P(≥ pips fonti del colore | ≥ turn terre) entro il turno `turn`, on the play,
 * condizionando la mano iniziale a 2–5 terre (mano tenuta).
 */
export const castOnCurveProbability = (
  deckSize: number,
  lands: number,
  sources: number,
  turn: number,
  pips: number,
): number => {
  const S = Math.min(sources, lands);
  const O = lands - S; // terre che non producono il colore
  const X = deckSize - lands;
  const draws = turn - 1;

  let num = 0;
  let den = 0;

  // mano iniziale: s1 fonti, o1 altre terre, x1 non-terre
  for (let s1 = 0; s1 <= Math.min(S, 7); s1++) {
    for (let o1 = 0; o1 <= Math.min(O, 7 - s1); o1++) {
      const x1 = 7 - s1 - o1;
      if (x1 > X || s1 + o1 < KEEP_MIN_LANDS || s1 + o1 > KEEP_MAX_LANDS) continue;

      const logP1 = logComb(S, s1) + logComb(O, o1) + logComb(X, x1) - logComb(deckSize, 7);
      const S2 = S - s1;
      const O2 = O - o1;
      const X2 = X - x1;
      const N2 = deckSize - 7;

      // pescate successive
      for (let s2 = 0; s2 <= Math.min(S2, draws); s2++) {
        for (let o2 = 0; o2 <= Math.min(O2, draws - s2); o2++) {
          const x2 = draws - s2 - o2;
          if (x2 > X2) continue;

          const p = Math.exp(logP1 + logComb(S2, s2) + logComb(O2, o2) + logComb(X2, x2) - logComb(N2, draws));
          if (s1 + o1 + s2 + o2 >= turn) {
            den += p;
            if (s1 + s2 >= pips) num += p;
          }
        }
      }
    }
  }

  return den === 0 ? 0 : num / den;
};

const requiredCache = new Map<string, number | null>();

/**
 * Numero minimo di fonti di un colore per lanciare in curva una carta di valore
 * di mana `turn` con `pips` simboli di quel colore.
 * Restituisce null se anche con tutte le terre come fonti non si raggiunge la soglia.
 */
export const requiredSources = (deckSize: number, lands: number, turn: number, pips: number): number | null => {
  const t = Math.min(7, Math.max(1, turn));
  const key = `${deckSize}:${lands}:${t}:${pips}`;
  if (requiredCache.has(key)) return requiredCache.get(key)!;

  const target = consistencyTarget(t);
  let result: number | null = null;
  for (let s = pips; s <= lands; s++) {
    if (castOnCurveProbability(deckSize, lands, s, t, pips) >= target) {
      result = s;
      break;
    }
  }

  requiredCache.set(key, result);
  return result;
};
