/**
 * Regole dei formati supportati. Mano, analisi, simulazione, statistiche e calcolatore
 * leggono i parametri del formato solo da qui.
 */

import type { DeckFormat } from './types';

export interface FormatRules {
  id: DeckFormat;
  label: string;
  /** Carte del mazzo, comandante incluso (minimo per il 60, esatte per il Commander) */
  deckSize: number;
  exactSize: boolean;
  /** Copie massime di una carta non base */
  maxCopies: number;
  sideboardMax: number;
  /** Il primo mulligan non fa mettere carte in fondo (multiplayer) */
  freeFirstMulligan: boolean;
  /** Il primo giocatore pesca anche al primo turno (multiplayer) */
  drawOnFirstTurn: boolean;
  /** Formula di Karsten per il numero di terre */
  landFormula: (averageManaValue: number, cheapDrawOrRamp: number, companion: boolean) => number;
  landFormulaText: string;
  /** Terre ipotizzate da Karsten per le tabelle delle fonti colorate */
  referenceLands: number;
}

export const FORMAT_RULES: Record<DeckFormat, FormatRules> = {
  constructed60: {
    id: 'constructed60',
    label: 'Constructed',
    deckSize: 60,
    exactSize: false,
    maxCopies: 4,
    sideboardMax: 15,
    freeFirstMulligan: false,
    drawOnFirstTurn: false,
    landFormula: (avg, cheap, companion) => 19.59 + 1.9 * avg - 0.28 * cheap + (companion ? 0.27 : 0),
    landFormulaText: '19.59 + 1.90 × costo medio − 0.28 × pescate/ramp economici + 0.27 × companion',
    referenceLands: 25,
  },
  commander: {
    id: 'commander',
    label: 'Commander',
    deckSize: 100,
    exactSize: true,
    maxCopies: 1,
    sideboardMax: 0,
    freeFirstMulligan: true,
    drawOnFirstTurn: true,
    landFormula: (avg, cheap) => 31.42 + 3.13 * avg - 0.28 * cheap,
    landFormulaText: '31.42 + 3.13 × costo medio − 0.28 × pescate/ramp economici',
    referenceLands: 41,
  },
};

export const rulesFor = (format: DeckFormat | undefined) => FORMAT_RULES[format ?? 'constructed60'];
