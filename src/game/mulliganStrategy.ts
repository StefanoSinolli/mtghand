/**
 * Strategia di mulligan di Frank Karsten (articolo "How Many Sources…", 2022), usata sia dal
 * modello esatto delle fonti colorate sia dalla simulazione:
 * - Commander: il primo 7 è gratuito e si tiene solo con 3–5 terre
 * - 7 carte: si tiene con 2–5 terre; 6 e 5 carte (dopo il fondo): con 2–4 terre; 4 carte: sempre
 * - in fondo si cerca di arrivare vicino a 3 terre, mettendo prima le terre del colore sbagliato
 */

export interface MulliganStep {
  /** Carte in mano dopo aver messo in fondo */
  handSize: number;
  minLands: number;
  maxLands: number;
}

export const mulliganSteps = (freeFirstMulligan: boolean): MulliganStep[] => [
  ...(freeFirstMulligan ? [{ handSize: 7, minLands: 3, maxLands: 5 }] : []),
  { handSize: 7, minLands: 2, maxLands: 5 },
  { handSize: 6, minLands: 2, maxLands: 4 },
  { handSize: 5, minLands: 2, maxLands: 4 },
  { handSize: 4, minLands: 0, maxLands: 7 },
];

/**
 * Quante magie mettere in fondo pescando 7 carte con `spells` magie e dovendone togliere `toBottom`
 * (6 carte: una magia se ne hai almeno 3; 5 carte: due magie con 4+, una magia e una terra con 3;
 * 4 carte: si punta a 3 terre e 1 magia). Il resto sono terre.
 */
export const spellsToBottom = (spells: number, toBottom: number) => {
  if (toBottom <= 0) return 0;
  const n = toBottom >= 3 ? spells - 1 : spells - 2;
  return Math.min(toBottom, spells, Math.max(0, n));
};
