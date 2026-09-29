import { useDeferredValue, useMemo, useState } from 'react';
import { buildProfiles } from '../analysis/analyze';
import { buildCalcCards, exactCurve, mulliganCurve, type CardGroup, type Condition, type Operator } from '../analysis/calculator';
import { collectRequirements } from '../analysis/manaBase';
import { keyColors, type ManaSymbolColor } from '../analysis/manaCost';
import { COLOR_NAMES } from '../analysis/warnings';
import { pct } from '../components/analysis/format';
import Button from '../components/ui/Button';
import Panel from '../components/ui/Panel';
import { ManaSymbol } from '../components/ui/ManaCost';
import { rulesFor } from '../formats';
import { getKeepRule } from '../store/mulliganLog';
import { CARD_TYPES, TYPE_LABELS, type CardType } from '../utils/deckSummary';
import { useDeckContext } from './deckContext';

const TURNS = 10;
const MAX_CONDITIONS = 3;
/** Colore delle barre: oro del tema validato per il fondo scuro (luminosità e contrasto) */
const BAR_COLOR = '#b08a2a';

const OPERATORS: Record<Operator, string> = { atLeast: 'almeno', exactly: 'esattamente', atMost: 'al massimo' };
const GROUP_KINDS: Record<CardGroup['kind'], string> = {
  cards: 'queste carte',
  lands: 'terre',
  type: 'carte di tipo',
  color: 'fonti di',
  manaValue: 'magie a costo ≤',
};

const defaultGroup = (kind: CardGroup['kind']): CardGroup => {
  switch (kind) {
    case 'cards':
      return { kind, names: [] };
    case 'lands':
      return { kind };
    case 'type':
      return { kind, type: 'Creature' };
    case 'color':
      return { kind, color: 'R' };
    case 'manaValue':
      return { kind, max: 1 };
  }
};

const TYPE_SINGULAR: Record<CardType, string> = {
  Creature: 'creatura',
  Planeswalker: 'planeswalker',
  Battle: 'battaglia',
  Instant: 'istantaneo',
  Sorcery: 'stregoneria',
  Artifact: 'artefatto',
  Enchantment: 'incantesimo',
  Land: 'terra',
  Other: 'altra carta',
};

const describeGroup = (g: CardGroup, n: number) => {
  const one = n === 1;
  switch (g.kind) {
    case 'cards':
      return g.names.length === 0 ? '(scegli le carte)' : g.names.length === 1 ? g.names[0] : `tra ${g.names.join(', ')}`;
    case 'lands':
      return one ? 'terra' : 'terre';
    case 'type':
      return one ? TYPE_SINGULAR[g.type] : TYPE_LABELS[g.type].toLowerCase();
    case 'color':
      return `${one ? 'fonte' : 'fonti'} di ${COLOR_NAMES[g.color]}`;
    case 'manaValue':
      return `${one ? 'magia' : 'magie'} a costo ≤ ${g.max}`;
  }
};

const describe = (c: Condition) => `${OPERATORS[c.op]} ${c.n} ${describeGroup(c.group, c.n)}`;

interface Preset {
  label: string;
  turn: number;
  conditions: (firstSpells: string[]) => Condition[];
}

const PRESETS: Preset[] = [
  {
    label: 'Terra + 1-drop al T1',
    turn: 1,
    conditions: () => [
      { op: 'atLeast', n: 1, group: { kind: 'lands' } },
      { op: 'atLeast', n: 1, group: { kind: 'manaValue', max: 1 } },
    ],
  },
  { label: '3 terre entro il T3', turn: 3, conditions: () => [{ op: 'atLeast', n: 3, group: { kind: 'lands' } }] },
  {
    label: 'Pezzi della combo entro il T4',
    turn: 4,
    conditions: (spells) => [
      { op: 'atLeast', n: 1, group: { kind: 'cards', names: spells.slice(0, 1) } },
      { op: 'atLeast', n: 1, group: { kind: 'cards', names: spells.slice(1, 2) } },
    ],
  },
];

export default function CalculatorPage() {
  const { deck, cards, loading } = useDeckContext();
  const rules = rulesFor(deck.format);
  const [conditions, setConditions] = useState<Condition[]>([{ op: 'atLeast', n: 3, group: { kind: 'lands' } }]);
  const [turn, setTurn] = useState(3);
  const [onTheDraw, setOnTheDraw] = useState(false);
  const [withMulligan, setWithMulligan] = useState(false);
  const drawOnFirstTurn = rules.drawOnFirstTurn || onTheDraw;

  const { profiles, calc, deckColors } = useMemo(() => {
    const { profiles, commanderProfiles } = buildProfiles(deck, cards);
    const colors = new Set<ManaSymbolColor>(
      collectRequirements([...profiles, ...commanderProfiles])
        .filter((r) => !r.alternative && r.key.length === 1)
        .flatMap((r) => keyColors(r.key)),
    );
    return { profiles, calc: buildCalcCards(profiles), deckColors: [...colors] };
  }, [deck, cards]);

  const spellNames = useMemo(
    () => calc.filter((c) => !c.isLand).sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)).map((c) => c.name),
    [calc],
  );
  const allNames = useMemo(() => [...calc].sort((a, b) => a.name.localeCompare(b.name)).map((c) => c.name), [calc]);
  const types = useMemo(() => CARD_TYPES.filter((t) => calc.some((c) => c.type === t)), [calc]);

  const input = useDeferredValue({ conditions, drawOnFirstTurn, withMulligan });
  const curve = useMemo(() => {
    if (calc.length === 0) return null;
    return input.withMulligan
      ? mulliganCurve(profiles, input.conditions, TURNS, {
          rule: getKeepRule(deck.id),
          freeFirstMulligan: rules.freeFirstMulligan,
          drawOnFirstTurn: input.drawOnFirstTurn,
          deckColors,
        })
      : exactCurve(calc, input.conditions, TURNS, input.drawOnFirstTurn);
  }, [calc, profiles, input, deck.id, rules.freeFirstMulligan, deckColors]);

  if (loading && cards.size === 0) {
    return <p className="animate-pulse py-24 text-center text-stone-400">Carico le carte…</p>;
  }

  const update = (i: number, next: Condition) => setConditions((list) => list.map((c, j) => (j === i ? next : c)));
  const result = curve?.[turn - 1] ?? 0;
  const timing = rules.drawOnFirstTurn ? 'multiplayer, pescata al T1' : onTheDraw ? 'on the draw' : 'on the play';

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="min-w-0 space-y-6">
        <Panel title="Condizioni" subtitle="Tutte devono essere vere insieme">
          <div className="mb-4 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                size="sm"
                variant="ghost"
                className="border border-white/10"
                onClick={() => {
                  setConditions(p.conditions(spellNames));
                  setTurn(p.turn);
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div className="space-y-3">
            {conditions.map((c, i) => (
              <ConditionRow
                key={i}
                condition={c}
                allNames={allNames}
                types={types}
                deckColors={deckColors}
                onChange={(next) => update(i, next)}
                onRemove={conditions.length > 1 ? () => setConditions((list) => list.filter((_, j) => j !== i)) : undefined}
              />
            ))}
          </div>
          {conditions.length < MAX_CONDITIONS && (
            <Button
              size="sm"
              className="mt-3"
              onClick={() => setConditions((list) => [...list, { op: 'atLeast', n: 1, group: { kind: 'cards', names: [] } }])}
            >
              + Condizione
            </Button>
          )}
        </Panel>

        <Panel title="Quando">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-stone-300">Entro il turno</span>
              <select
                value={turn}
                onChange={(e) => setTurn(Number(e.target.value))}
                className="h-9 rounded-lg border border-white/10 bg-felt-900 px-2 text-stone-100"
              >
                {Array.from({ length: TURNS }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>
            {rules.drawOnFirstTurn ? (
              <span className="text-stone-400">Commander multiplayer: si pesca anche al turno 1</span>
            ) : (
              <div className="flex rounded-lg bg-black/30 p-0.5 text-xs font-semibold">
                {[false, true].map((draw) => (
                  <button
                    key={String(draw)}
                    onClick={() => setOnTheDraw(draw)}
                    aria-pressed={onTheDraw === draw}
                    className={`cursor-pointer rounded-md px-2.5 py-1.5 ${onTheDraw === draw ? 'bg-gold-400 text-felt-950' : 'text-stone-400'}`}
                  >
                    {draw ? 'On the draw' : 'On the play'}
                  </button>
                ))}
              </div>
            )}
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={withMulligan}
                onChange={(e) => setWithMulligan(e.target.checked)}
                className="h-4 w-4 accent-gold-400"
              />
              <span className="text-stone-300">Considera il mulligan</span>
            </label>
          </div>
          <p className="mt-3 text-xs text-stone-500">
            {withMulligan
              ? 'Simulazione di 10.000 partite con la regola di keep di questo mazzo (scheda Statistiche).'
              : 'Calcolo esatto sulle prime carte del mazzo, senza mulligan.'}
          </p>
        </Panel>
      </div>

      <div className="order-first space-y-6 lg:sticky lg:top-24 lg:order-none lg:self-start">
        <Panel>
          <p className="text-5xl font-bold text-gold-200 tabular-nums">{pct(result)}</p>
          <p className="mt-3 text-sm leading-relaxed text-stone-300">
            Probabilità di avere {conditions.map(describe).join(' e ')} entro il turno {turn} ({timing}
            {withMulligan ? ', con mulligan' : ''}).
          </p>
        </Panel>
        {curve && (
          <Panel title="Turno per turno">
            <TurnChart values={curve} selected={turn} onSelect={setTurn} />
          </Panel>
        )}
      </div>
    </div>
  );
}

interface ConditionRowProps {
  condition: Condition;
  allNames: string[];
  types: CardType[];
  deckColors: ManaSymbolColor[];
  onChange: (c: Condition) => void;
  onRemove?: () => void;
}

const selectClass = 'h-9 rounded-lg border border-white/10 bg-felt-900 px-2 text-sm text-stone-100';

function ConditionRow({ condition, allNames, types, deckColors, onChange, onRemove }: ConditionRowProps) {
  const { op, n, group } = condition;
  const colors: ManaSymbolColor[] = deckColors.length > 0 ? deckColors : ['W', 'U', 'B', 'R', 'G'];

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={op} onChange={(e) => onChange({ ...condition, op: e.target.value as Operator })} className={selectClass}>
          {(Object.keys(OPERATORS) as Operator[]).map((o) => (
            <option key={o} value={o}>
              {OPERATORS[o]}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          max={20}
          value={n}
          onChange={(e) => onChange({ ...condition, n: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })}
          className="h-9 w-16 rounded-lg border border-white/10 bg-black/30 px-2 text-center text-stone-100 tabular-nums"
          aria-label="Quante"
        />
        <select
          value={group.kind}
          onChange={(e) => onChange({ ...condition, group: defaultGroup(e.target.value as CardGroup['kind']) })}
          className={selectClass}
        >
          {(Object.keys(GROUP_KINDS) as CardGroup['kind'][]).map((k) => (
            <option key={k} value={k}>
              {GROUP_KINDS[k]}
            </option>
          ))}
        </select>

        {group.kind === 'type' && (
          <select value={group.type} onChange={(e) => onChange({ ...condition, group: { ...group, type: e.target.value as CardType } })} className={selectClass}>
            {types.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t].toLowerCase()}
              </option>
            ))}
          </select>
        )}
        {group.kind === 'color' && (
          <div className="flex gap-1">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => onChange({ ...condition, group: { ...group, color: c } })}
                aria-pressed={group.color === c}
                aria-label={COLOR_NAMES[c]}
                className={`cursor-pointer rounded-full p-1 ${group.color === c ? 'bg-gold-400/30 ring-2 ring-gold-400' : 'opacity-60 hover:opacity-100'}`}
              >
                <ManaSymbol symbol={c} size="lg" />
              </button>
            ))}
          </div>
        )}
        {group.kind === 'manaValue' && (
          <input
            type="number"
            min={0}
            max={15}
            value={group.max}
            onChange={(e) => onChange({ ...condition, group: { ...group, max: Math.max(0, Number(e.target.value) || 0) } })}
            className="h-9 w-16 rounded-lg border border-white/10 bg-black/30 px-2 text-center text-stone-100 tabular-nums"
            aria-label="Costo massimo"
          />
        )}

        {onRemove && (
          <button onClick={onRemove} aria-label="Rimuovi condizione" className="ml-auto cursor-pointer rounded-md px-2 py-1 text-stone-500 hover:bg-red-500/20 hover:text-red-200">
            ✕
          </button>
        )}
      </div>

      {group.kind === 'cards' && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {group.names.map((name) => (
            <span key={name} className="flex items-center gap-1 rounded-full bg-gold-400/15 py-0.5 pr-1 pl-2.5 text-xs text-gold-100">
              {name}
              <button
                onClick={() => onChange({ ...condition, group: { ...group, names: group.names.filter((x) => x !== name) } })}
                aria-label={`Togli ${name}`}
                className="cursor-pointer rounded-full px-1 hover:bg-black/30"
              >
                ✕
              </button>
            </span>
          ))}
          <select
            value=""
            onChange={(e) => e.target.value && onChange({ ...condition, group: { ...group, names: [...group.names, e.target.value] } })}
            className={`${selectClass} h-8 text-xs`}
          >
            <option value="">+ aggiungi carta…</option>
            {allNames
              .filter((name) => !group.names.includes(name))
              .map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
          </select>
        </div>
      )}
    </div>
  );
}

/** Barre della probabilità per turno: una sola serie, tooltip al passaggio e tabella dei valori */
function TurnChart({ values, selected, onSelect }: { values: number[]; selected: number; onSelect: (turn: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? selected;

  return (
    <div className="pt-7">
      <div className="relative flex h-40 items-end gap-0.5 border-b border-white/10">
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <div key={g} className="pointer-events-none absolute inset-x-0 border-t border-white/5" style={{ bottom: `${g * 100}%` }} />
        ))}
        {values.map((v, i) => {
          const turn = i + 1;
          return (
            <button
              key={turn}
              className="group relative flex h-full flex-1 cursor-pointer items-end justify-center"
              onMouseEnter={() => setHover(turn)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(turn)}
              onBlur={() => setHover(null)}
              onClick={() => onSelect(turn)}
              aria-label={`Turno ${turn}: ${pct(v)}`}
            >
              <div
                className="w-full max-w-7 rounded-t transition-[height,opacity] duration-300"
                style={{
                  height: `${v * 100}%`,
                  minHeight: v > 0 ? 2 : 0,
                  background: BAR_COLOR,
                  opacity: turn === shown ? 1 : 0.55,
                  outline: turn === selected ? '2px solid rgb(238 212 138 / 0.9)' : undefined,
                  outlineOffset: 2,
                }}
              />
              {turn === shown && (
                <span className="absolute -top-6 rounded bg-felt-950 px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-stone-100 shadow">
                  T{turn} · {pct(v)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex gap-0.5">
        {values.map((_, i) => (
          <span key={i} className={`flex-1 text-center text-[11px] ${i + 1 === selected ? 'font-bold text-stone-100' : 'text-stone-500'}`}>
            {i + 1}
          </span>
        ))}
      </div>
      <details className="mt-3 text-xs text-stone-400">
        <summary className="cursor-pointer select-none">Mostra i valori</summary>
        <table className="mt-2 w-full tabular-nums">
          <tbody>
            {values.map((v, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className="py-0.5">Turno {i + 1}</td>
                <td className="py-0.5 text-right text-stone-200">{(v * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
