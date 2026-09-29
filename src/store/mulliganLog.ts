/**
 * Storico delle decisioni di mulligan prese nel simulatore e regola di keep, per mazzo (localStorage)
 */

import { useCallback, useSyncExternalStore } from 'react';
import { DEFAULT_KEEP_RULE, type KeepRule, type MulliganReason } from '../analysis/mulliganStats';

export interface MulliganDecision {
  at: string;
  /** Mulligan già fatti quando è stata presa la decisione */
  mulligans: number;
  /** Carte che si terrebbero con questa mano */
  handSize: number;
  lands: number;
  action: 'keep' | 'mulligan';
  /** Cosa avrebbe fatto la regola di keep */
  ruleKeep: boolean;
  ruleReason?: MulliganReason;
}

const LOG_KEY = 'mtg_mulligan_log';
const RULE_KEY = 'mtg_keep_rules';
const MAX_DECISIONS = 500;

type LogData = Record<string, MulliganDecision[]>;
type RuleData = Record<string, KeepRule>;

const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // spazio esaurito o storage bloccato: lo storico è un di più
  }
};

const listeners = new Set<() => void>();
let logSnapshot: LogData = read<LogData>(LOG_KEY, {});
let ruleSnapshot: RuleData = read<RuleData>(RULE_KEY, {});

const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const EMPTY: MulliganDecision[] = [];

export const recordDecision = (deckId: string, decision: Omit<MulliganDecision, 'at'>) => {
  const list = [...(logSnapshot[deckId] ?? []), { ...decision, at: new Date().toISOString() }].slice(-MAX_DECISIONS);
  logSnapshot = { ...logSnapshot, [deckId]: list };
  write(LOG_KEY, logSnapshot);
  emit();
};

export const clearDecisions = (deckId: string) => {
  const { [deckId]: _removed, ...rest } = logSnapshot;
  logSnapshot = rest;
  write(LOG_KEY, logSnapshot);
  emit();
};

export const useMulliganLog = (deckId: string) =>
  useSyncExternalStore(subscribe, () => logSnapshot[deckId] ?? EMPTY);

export const getKeepRule = (deckId: string): KeepRule => ({ ...DEFAULT_KEEP_RULE, ...ruleSnapshot[deckId] });

export const useKeepRule = (deckId: string) => {
  const stored = useSyncExternalStore(subscribe, () => ruleSnapshot[deckId]);
  const rule: KeepRule = stored ? { ...DEFAULT_KEEP_RULE, ...stored } : DEFAULT_KEEP_RULE;

  const setRule = useCallback(
    (next: KeepRule | null) => {
      if (next) {
        ruleSnapshot = { ...ruleSnapshot, [deckId]: next };
      } else {
        const { [deckId]: _removed, ...rest } = ruleSnapshot;
        ruleSnapshot = rest;
      }
      write(RULE_KEY, ruleSnapshot);
      emit();
    },
    [deckId],
  );

  return [rule, setRule] as const;
};

export interface PersonalStats {
  hands: number;
  games: number;
  keptAtSeven: number;
  averageMulligans: number;
  /** Mani tenute che la regola avrebbe rimescolato */
  keptAgainstRule: number;
  /** Mani rimescolate che la regola avrebbe tenuto */
  mulliganedAgainstRule: number;
}

export const personalStats = (decisions: MulliganDecision[]): PersonalStats => {
  const keeps = decisions.filter((d) => d.action === 'keep');
  return {
    hands: decisions.length,
    games: keeps.length,
    keptAtSeven: keeps.length > 0 ? keeps.filter((d) => d.handSize === 7).length / keeps.length : 0,
    averageMulligans: keeps.length > 0 ? keeps.reduce((s, d) => s + d.mulligans, 0) / keeps.length : 0,
    keptAgainstRule: keeps.filter((d) => !d.ruleKeep).length,
    mulliganedAgainstRule: decisions.filter((d) => d.action === 'mulligan' && d.ruleKeep).length,
  };
};
