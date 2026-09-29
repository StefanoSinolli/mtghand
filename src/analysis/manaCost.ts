/**
 * Parsing dei costi di mana Scryfall, es. "{2}{U}{R/P}{G/W}"
 */

import type { ManaColor } from '../types';

export const COLORS: ManaColor[] = ['W', 'U', 'B', 'R', 'G'];

/** Colore richiesto da un simbolo; 'C' = mana incolore specifico ({C}) */
export type ManaSymbolColor = ManaColor | 'C';

export interface ParsedCost {
  /** Mana generico ({2}) */
  generic: number;
  /** Numero di {X}/{Y}/{Z} */
  x: number;
  /** Simboli colorati obbligatori. Un simbolo ibrido {G/W} ha più colori */
  pips: ManaSymbolColor[][];
  /** Simboli pagabili anche senza colore: phyrexian {R/P} e twobrid {2/W} */
  optionalPips: ManaSymbolColor[][];
  /** Valore di mana del costo (X = 0) */
  manaValue: number;
}

const isColor = (s: string): s is ManaSymbolColor => s === 'C' || (COLORS as string[]).includes(s);

export const parseManaCost = (cost: string | undefined): ParsedCost => {
  const parsed: ParsedCost = { generic: 0, x: 0, pips: [], optionalPips: [], manaValue: 0 };
  if (!cost) return parsed;

  for (const [, symbol] of cost.matchAll(/\{([^}]+)\}/g)) {
    if (/^\d+$/.test(symbol)) {
      parsed.generic += parseInt(symbol, 10);
      parsed.manaValue += parseInt(symbol, 10);
      continue;
    }

    if (symbol === 'X' || symbol === 'Y' || symbol === 'Z') {
      parsed.x++;
      continue;
    }

    // Neve {S}: si paga con mana da fonte snow, lo trattiamo come generico
    if (symbol === 'S') {
      parsed.generic++;
      parsed.manaValue++;
      continue;
    }

    const parts = symbol.split('/');
    const colors = parts.filter(isColor);
    const phyrexian = parts.includes('P');
    const twobrid = parts.includes('2');

    parsed.manaValue += twobrid ? 2 : 1;

    if (colors.length === 0) {
      // simbolo sconosciuto (es. {HW} di Un-set): conta come generico
      parsed.generic++;
    } else if (phyrexian || twobrid) {
      parsed.optionalPips.push(colors);
    } else {
      parsed.pips.push(colors);
    }
  }

  return parsed;
};

/**
 * Raggruppa i simboli obbligatori per "gruppo di colori".
 * {U}{U}{R} → { U: 2, R: 1 };  {1}{G/W}{G/W} → { GW: 2 }
 */
export const groupPips = (pips: ManaSymbolColor[][]): Map<string, number> => {
  const groups = new Map<string, number>();
  for (const colors of pips) {
    const key = colorKey(colors);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return groups;
};

/** Chiave stabile per un insieme di colori, in ordine WUBRG */
export const colorKey = (colors: Iterable<ManaSymbolColor>): string => {
  const set = new Set(colors);
  return (['W', 'U', 'B', 'R', 'G', 'C'] as const).filter((c) => set.has(c)).join('');
};

export const keyColors = (key: string) => key.split('') as ManaSymbolColor[];
