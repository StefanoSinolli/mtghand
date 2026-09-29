import { useDeferredValue, useMemo } from 'react';
import { buildProfiles } from '../analysis/analyze';
import { collectRequirements } from '../analysis/manaBase';
import { keyColors, type ManaSymbolColor } from '../analysis/manaCost';
import {
  DEFAULT_KEEP_RULE,
  REASON_LABELS,
  simulateMulligans,
  type LandRange,
} from '../analysis/mulliganStats';
import { buildLibrary } from '../analysis/simulate';
import { pct } from '../components/analysis/format';
import Button from '../components/ui/Button';
import Panel from '../components/ui/Panel';
import { ColorKey } from '../components/ui/ManaCost';
import { useConfirm } from '../components/ui/confirm';
import { rulesFor } from '../formats';
import { clearDecisions, personalStats, useKeepRule, useMulliganLog } from '../store/mulliganLog';
import { useDeckContext } from './deckContext';

export default function StatsPage() {
  const { deck, cards, loading } = useDeckContext();
  const rules = rulesFor(deck.format);
  const [rule, setRule] = useKeepRule(deck.id);
  const deferredRule = useDeferredValue(rule);

  const { library, deckColors } = useMemo(() => {
    const { profiles, commanderProfiles } = buildProfiles(deck, cards);
    const colors = new Set<ManaSymbolColor>(
      collectRequirements([...profiles, ...commanderProfiles])
        .filter((r) => !r.alternative && r.key.length === 1)
        .flatMap((r) => keyColors(r.key)),
    );
    return { library: buildLibrary(profiles), deckColors: [...colors] };
  }, [deck, cards]);

  // 10.000 mani si simulano in poche decine di millisecondi: si ricalcola a ogni modifica della regola
  const stats = useMemo(
    () =>
      library.length >= 7
        ? simulateMulligans(library, deferredRule, { freeFirstMulligan: rules.freeFirstMulligan, deckColors })
        : null,
    [library, deferredRule, rules.freeFirstMulligan, deckColors],
  );

  if (loading && cards.size === 0) {
    return <p className="animate-pulse py-24 text-center text-stone-400">Carico le carte…</p>;
  }

  const custom = JSON.stringify(rule) !== JSON.stringify(DEFAULT_KEEP_RULE);

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="space-y-6">
        <Panel
          title="Regola di keep"
          subtitle="Quando tieni una mano"
          actions={
            custom && (
              <Button size="sm" variant="ghost" onClick={() => setRule(null)}>
                Ripristina
              </Button>
            )
          }
        >
          <div className="space-y-3 text-sm">
            {rules.freeFirstMulligan && (
              <RangeRow label="Primo 7 (gratuito)" range={rule.freeSeven} onChange={(freeSeven) => setRule({ ...rule, freeSeven })} />
            )}
            <RangeRow label="7 carte" range={rule.seven} onChange={(seven) => setRule({ ...rule, seven })} />
            <RangeRow label="6 carte" range={rule.six} onChange={(six) => setRule({ ...rule, six })} />
            <RangeRow label="5 carte" range={rule.five} onChange={(five) => setRule({ ...rule, five })} />
            <p className="text-xs text-stone-500">Terre dopo aver messo le carte in fondo. Le mani da 4 si tengono sempre.</p>

            <label className="flex cursor-pointer items-center gap-2 pt-2">
              <input
                type="checkbox"
                checked={rule.requireAllColors}
                onChange={(e) => setRule({ ...rule, requireAllColors: e.target.checked })}
                className="h-4 w-4 accent-gold-400"
              />
              <span>Una terra per ogni colore</span>
              {deckColors.length > 0 && <ColorKey colorKey={deckColors.join('')} size="sm" />}
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <span>Almeno</span>
              <NumberInput value={rule.minCheapSpells} min={0} max={7} onChange={(minCheapSpells) => setRule({ ...rule, minCheapSpells })} />
              <span>magie a costo ≤</span>
              <NumberInput value={rule.cheapThreshold} min={1} max={4} onChange={(cheapThreshold) => setRule({ ...rule, cheapThreshold })} />
            </div>
          </div>
          <p className="mt-4 text-xs text-stone-500">
            Valori iniziali: la strategia di Frank Karsten. La regola si salva per questo mazzo e serve anche a giudicare
            le tue decisioni nella scheda Mano.
          </p>
        </Panel>
      </div>

      <div className="min-w-0 space-y-6">
        {stats && (
          <Panel title="Simulazione" subtitle={`${stats.games.toLocaleString('it-IT')} mani con questa regola`}>
            <div className="grid gap-3 sm:grid-cols-4">
              <Big value={pct(stats.keptSizes[0].share)} label="Tenute a 7" />
              <Big value={stats.averageHandSize.toFixed(2)} label="Carte medie in mano" />
              <Big value={pct(stats.turnOnePlay)} label="Giocata al T1" hint="con le sole carte in mano" />
              <Big value={pct(stats.turnTwoPlay)} label="Giocata al T2" hint="con le sole carte in mano" />
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-semibold tracking-wider text-stone-500 uppercase">Mano tenuta</h3>
                <Bars
                  rows={stats.keptSizes.map((k) => ({
                    label: k.size === 4 ? '4 o meno' : `${k.size} carte`,
                    value: k.share,
                  }))}
                />
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold tracking-wider text-stone-500 uppercase">Perché si fa mulligan</h3>
                {stats.reasons.length === 0 ? (
                  <p className="text-sm text-stone-500">Nessun mulligan con questa regola.</p>
                ) : (
                  <Bars rows={stats.reasons.map((r) => ({ label: REASON_LABELS[r.reason], value: r.share }))} tone="warn" />
                )}
              </div>
            </div>

            <h3 className="mt-6 mb-2 text-xs font-semibold tracking-wider text-stone-500 uppercase">Terre nelle mani tenute</h3>
            <div className="flex h-24 items-end gap-1.5">
              {stats.landsInKeptHand.map((p, lands) => (
                <div key={lands} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[11px] text-stone-400 tabular-nums">{p >= 0.005 ? pct(p) : ''}</span>
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-gold-600 to-gold-300"
                    style={{ height: `${(p / Math.max(...stats.landsInKeptHand)) * 100}%`, minHeight: p > 0 ? 2 : 0 }}
                  />
                  <span className="text-xs font-bold text-stone-400">{lands}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-stone-500">Media mulligan per partita: {stats.averageMulligans.toFixed(2)}</p>
          </Panel>
        )}

        <PersonalLog deckId={deck.id} />
      </div>
    </div>
  );
}

function PersonalLog({ deckId }: { deckId: string }) {
  const decisions = useMulliganLog(deckId);
  const confirm = useConfirm();
  const stats = personalStats(decisions);

  const reset = async () => {
    if (await confirm({ title: 'Azzerare lo storico?', message: 'Le tue decisioni su questo mazzo verranno cancellate.', confirmLabel: 'Azzera', danger: true })) {
      clearDecisions(deckId);
    }
  };

  return (
    <Panel
      title="Il tuo storico"
      subtitle="Le decisioni prese nella scheda Mano"
      actions={
        decisions.length > 0 && (
          <Button size="sm" variant="ghost" onClick={reset}>
            Azzera
          </Button>
        )
      }
    >
      {stats.games === 0 ? (
        <p className="text-sm text-stone-400">
          Pesca qualche mano nella scheda Mano: ogni Mulligan e Keep verrà registrato qui e confrontato con la regola.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Big value={String(stats.games)} label="Mani tenute" hint={`${stats.hands} mani viste`} />
            <Big value={pct(stats.keptAtSeven)} label="Tenute a 7" />
            <Big value={stats.averageMulligans.toFixed(2)} label="Mulligan medi" />
            <Big
              value={String(stats.keptAgainstRule + stats.mulliganedAgainstRule)}
              label="Diverse dalla regola"
              hint={`${stats.keptAgainstRule} tenute, ${stats.mulliganedAgainstRule} rimescolate`}
            />
          </div>
          {stats.keptAgainstRule > 0 && (
            <p className="mt-4 text-sm text-stone-300">
              Hai tenuto {stats.keptAgainstRule} {stats.keptAgainstRule === 1 ? 'mano' : 'mani'} che la regola avrebbe
              rimescolato
              {stats.mulliganedAgainstRule > 0 &&
                ` e rimescolato ${stats.mulliganedAgainstRule} ${stats.mulliganedAgainstRule === 1 ? 'mano' : 'mani'} che avrebbe tenuto`}
              .
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

function RangeRow({ label, range, onChange }: { label: string; range: LandRange; onChange: (r: LandRange) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-stone-300">{label}</span>
      <span className="flex items-center gap-1.5 text-stone-400">
        da <NumberInput value={range.min} min={0} max={range.max} onChange={(min) => onChange({ ...range, min })} />
        a <NumberInput value={range.max} min={range.min} max={7} onChange={(max) => onChange({ ...range, max })} /> terre
      </span>
    </div>
  );
}

function NumberInput({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))));
      }}
      className="h-8 w-14 rounded-lg border border-white/10 bg-black/30 px-2 text-center text-stone-100 tabular-nums focus:border-gold-400/60 focus:outline-none"
    />
  );
}

function Big({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-black/25 p-3">
      <p className="text-2xl font-bold text-stone-50 tabular-nums">{value}</p>
      <p className="text-xs font-medium text-stone-400">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

function Bars({ rows, tone = 'gold' }: { rows: Array<{ label: string; value: number }>; tone?: 'gold' | 'warn' }) {
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-2 text-sm">
          <span className="text-stone-300">{r.label}</span>
          <div className="h-2.5 rounded-full bg-white/10">
            <div
              className={`h-full rounded-full ${tone === 'warn' ? 'bg-amber-500' : 'bg-gradient-to-r from-gold-600 to-gold-300'}`}
              style={{ width: `${r.value * 100}%` }}
            />
          </div>
          <span className="text-right text-stone-400 tabular-nums">{pct(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}
