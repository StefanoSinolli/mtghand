/**
 * Pagamento del mana e terre che entrano tappate: condiviso da simulazione e prova di gioco
 */

import type { BasicType, TappedRule } from '../analysis/cardProfile';
import type { ManaSymbolColor } from '../analysis/manaCost';

export interface ManaSource {
  id: string;
  /** Colori che può produrre (uno per volta) */
  colors: ManaSymbolColor[];
  /** Mana prodotto tappandola (Sol Ring: 2) */
  amount: number;
}

/**
 * Sceglie quali fonti tappare per pagare i simboli colorati (`pips`, ognuno con i colori che lo pagano)
 * più `generic` mana generico. Restituisce gli id delle fonti da tappare, o null se non basta.
 * I simboli si assegnano con un matching bipartito; il generico usa prima il mana avanzato dalle
 * fonti già tappate, poi le fonti con meno colori (per conservare quelle flessibili).
 */
export const payCost = (pips: ManaSymbolColor[][], generic: number, sources: ManaSource[]): string[] | null => {
  // le fonti con meno colori vengono provate per prime
  const ordered = [...sources].sort((a, b) => a.colors.length - b.colors.length);
  const units = ordered.flatMap((s, i) => Array.from({ length: s.amount }, () => ({ source: i, colors: s.colors })));
  if (units.length < pips.length + generic) return null;

  const owner = new Array<number>(units.length).fill(-1);
  const assign = (pip: number, seen: boolean[]): boolean => {
    for (let u = 0; u < units.length; u++) {
      if (seen[u] || !pips[pip].some((c) => units[u].colors.includes(c))) continue;
      seen[u] = true;
      if (owner[u] === -1 || assign(owner[u], seen)) {
        owner[u] = pip;
        return true;
      }
    }
    return false;
  };
  for (let pip = 0; pip < pips.length; pip++) {
    if (!assign(pip, new Array<boolean>(units.length).fill(false))) return null;
  }

  const used = new Set(owner.flatMap((o, u) => (o === -1 ? [] : [units[u].source])));
  const free = units.map((u, i) => ({ ...u, i })).filter((u) => owner[u.i] === -1);
  // prima il mana avanzato dalle fonti già tappate
  free.sort((a, b) => Number(used.has(b.source)) - Number(used.has(a.source)));
  for (const unit of free.slice(0, generic)) used.add(unit.source);

  return [...used].map((i) => ordered[i].id);
};

/** Vero se i simboli colorati si possono pagare con le fonti date */
export const canPayPips = (pips: ManaSymbolColor[][], sources: ManaSource[]) => payCost(pips, 0, sources) !== null;

/**
 * Una terra entra tappata? `landsInPlay` sono le terre già in gioco con i loro tipi base.
 * Shock land: si paga la vita; condizioni sconosciute: ipotesi ottimistica.
 */
export const landEntersTapped = (
  rule: TappedRule,
  fetchTapped: boolean,
  landsInPlay: Array<{ basicTypes: BasicType[] }>,
) => {
  if (fetchTapped) return true;
  switch (rule.kind) {
    case 'never':
    case 'shock':
    case 'conditional':
      return false;
    case 'always':
      return true;
    case 'fast':
      return landsInPlay.length > 2;
    case 'slow':
      return landsInPlay.length >= 2;
    case 'check':
      return !landsInPlay.some((l) => l.basicTypes.some((t) => rule.types.includes(t)));
  }
};
