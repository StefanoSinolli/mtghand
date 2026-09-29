import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { useCards } from '../hooks/useDeckCards';
import { createDeck } from '../services/deckStorage';
import { saveDeck } from '../store/decks';
import { countCards } from '../utils/deckParser';
import { addCopies, moveEntry, removeEntry, setQuantity } from '../utils/deckEdit';
import { groupByType, isBasicLand, TYPE_LABELS } from '../utils/deckSummary';
import { isPlaceholder, type DeckEntry, type DeckFormat, type DisplayCard } from '../types';
import { FORMAT_RULES } from '../formats';
import CardImage from '../components/cards/CardImage';
import CardSearch from '../components/cards/CardSearch';
import Button from '../components/ui/Button';
import ManaCost from '../components/ui/ManaCost';
import Panel from '../components/ui/Panel';
import { useConfirm } from '../components/ui/confirm';
import type { DeckContext } from './deckContext';

type Board = 'main' | 'side' | 'commander';

const MAX_COMMANDERS = 2;

export default function EditorPage() {
  const context = useOutletContext<DeckContext | undefined>();
  const existing = context?.deck;
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [name, setName] = useState(existing?.name ?? '');
  const [main, setMain] = useState<DeckEntry[]>(existing?.main ?? []);
  const [side, setSide] = useState<DeckEntry[]>(existing?.side ?? []);
  const [format, setFormat] = useState<DeckFormat>(existing?.format ?? 'constructed60');
  const [commanders, setCommanders] = useState<DeckEntry[]>(existing?.commanders ?? []);
  const [target, setTarget] = useState<Board>('main');
  const [previewName, setPreviewName] = useState<string | null>(null);
  const rules = FORMAT_RULES[format];
  const isCommander = format === 'commander';

  const names = useMemo(() => [...commanders, ...main, ...side].map((e) => e.name), [commanders, main, side]);
  const { cards, getCard } = useCards(names);

  // ricavata a ogni render: i dati di una carta appena aggiunta arrivano dopo
  const preview = previewName ? getCard(previewName) : null;

  const mainCount = countCards(main);
  const sideCount = countCards(side);
  const commanderCount = countCards(commanders);
  const dirty =
    name !== (existing?.name ?? '') ||
    format !== (existing?.format ?? 'constructed60') ||
    JSON.stringify([main, side, commanders]) !==
      JSON.stringify([existing?.main ?? [], existing?.side ?? [], existing?.commanders ?? []]);

  const update = (board: Board, fn: (list: DeckEntry[]) => DeckEntry[]) =>
    board === 'main' ? setMain(fn) : board === 'side' ? setSide(fn) : setCommanders(fn);

  const handleAdd = (cardName: string) => {
    if (target === 'commander' && commanderCount >= MAX_COMMANDERS) return;
    update(target, (list) => addCopies(list, cardName));
    setPreviewName(cardName);
  };

  const changeFormat = (next: DeckFormat) => {
    setFormat(next);
    setTarget('main');
  };

  /** Sposta una copia dal mazzo al comandante (o viceversa) */
  const toCommander = (cardName: string) => {
    if (commanderCount >= MAX_COMMANDERS) return;
    const entry = main.find((e) => e.name === cardName);
    if (!entry) return;
    setMain((l) => setQuantity(l, cardName, entry.quantity - 1));
    setCommanders((l) => addCopies(l, cardName, 1));
  };
  const fromCommander = (cardName: string) => {
    setCommanders((l) => removeEntry(l, cardName));
    setMain((l) => addCopies(l, cardName, 1));
  };

  const handleMove = (from: Board, cardName: string) => {
    const [a, b] = from === 'main' ? moveEntry(main, side, cardName) : moveEntry(side, main, cardName);
    if (from === 'main') {
      setMain(a);
      setSide(b);
    } else {
      setSide(a);
      setMain(b);
    }
  };

  const handleSave = () => {
    const deckName = name.trim() || 'Nuovo mazzo';
    const deck = existing
      ? { ...existing, name: deckName, format, main, side, commanders: isCommander ? commanders : undefined }
      : createDeck(deckName, main, side, format, commanders);
    saveDeck(deck);
    navigate(`/deck/${deck.id}`);
  };

  const handleCancel = async () => {
    if (dirty && !(await confirm({ title: 'Annullare le modifiche?', message: 'Le modifiche non salvate andranno perse.', confirmLabel: 'Esci senza salvare', danger: true }))) {
      return;
    }
    navigate(existing ? `/deck/${existing.id}` : '/');
  };

  return (
    <div className="space-y-6">
      {!existing && (
        <h1 className="font-display text-3xl font-bold tracking-wide text-gold-gradient">Nuovo mazzo</h1>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0 space-y-6">
          {/* z-20: i suggerimenti della ricerca devono stare sopra i pannelli successivi */}
          <Panel className="relative z-20">
            <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
              <label className="block">
                <span className="flex items-center justify-between text-sm font-semibold text-stone-300">
                  Nome
                  <span className="flex rounded-lg bg-black/30 p-0.5 text-xs font-semibold">
                    {(['constructed60', 'commander'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => changeFormat(f)}
                        aria-pressed={format === f}
                        className={`cursor-pointer rounded-md px-2.5 py-1 ${format === f ? 'bg-gold-400 text-felt-950' : 'text-stone-400'}`}
                      >
                        {FORMAT_RULES[f].label}
                      </button>
                    ))}
                  </span>
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Es. Izzet Murktide"
                  className="mt-1.5 h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-stone-100 placeholder:text-stone-600 focus:border-gold-400/60 focus:outline-none"
                />
              </label>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-stone-300">Aggiungi carte</span>
                  <div className="flex rounded-lg bg-black/30 p-0.5 text-xs font-semibold">
                    {(isCommander ? (['commander', 'main'] as const) : (['main', 'side'] as const)).map((b) => (
                      <button
                        key={b}
                        onClick={() => setTarget(b)}
                        className={`cursor-pointer rounded-md px-2.5 py-1 ${target === b ? 'bg-gold-400 text-felt-950' : 'text-stone-400'}`}
                      >
                        {b === 'main' ? (isCommander ? 'Mazzo' : 'Main') : b === 'side' ? 'Sideboard' : 'Comandante'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-1.5">
                  <CardSearch onSelect={handleAdd} />
                </div>
              </div>
            </div>
          </Panel>

          {isCommander && (
            <BoardPanel
              title="Comandante"
              count={commanderCount}
              target={MAX_COMMANDERS}
              maxCopies={1}
              entries={commanders}
              cards={cards}
              emptyText="Nessun comandante. Cercalo qui sopra con “Comandante” selezionato, o usa ★ su una carta del mazzo."
              onQuantity={(n, q) => (q <= 0 ? setCommanders((l) => removeEntry(l, n)) : undefined)}
              onRemove={(n) => setCommanders((l) => removeEntry(l, n))}
              onMove={fromCommander}
              moveLabel="→ Mazzo"
              onPreview={(card) => setPreviewName(card.name)}
            />
          )}
          <BoardPanel
            title={isCommander ? 'Mazzo' : 'Main deck'}
            count={mainCount}
            target={isCommander ? 99 : 60}
            maxCopies={rules.maxCopies}
            entries={main}
            cards={cards}
            onQuantity={(n, q) => setMain((l) => setQuantity(l, n, q))}
            onRemove={(n) => setMain((l) => removeEntry(l, n))}
            onMove={(n) => (isCommander ? toCommander(n) : handleMove('main', n))}
            moveLabel={isCommander ? '★ Comandante' : '→ Side'}
            onPreview={(card) => setPreviewName(card.name)}
          />
          {!isCommander && (
            <BoardPanel
              title="Sideboard"
              count={sideCount}
              target={15}
              maxCopies={rules.maxCopies}
              entries={side}
              cards={cards}
              onQuantity={(n, q) => setSide((l) => setQuantity(l, n, q))}
              onRemove={(n) => setSide((l) => removeEntry(l, n))}
              onMove={(n) => handleMove('side', n)}
              moveLabel="→ Main"
              onPreview={(card) => setPreviewName(card.name)}
            />
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Panel>
            <div className="space-y-2 text-sm">
              {isCommander ? (
                <>
                  <Counter label="Totale" value={mainCount + commanderCount} ok={mainCount + commanderCount === 100} hint="esatte 100" />
                  <Counter label="Comandante" value={commanderCount} ok={commanderCount >= 1 && commanderCount <= MAX_COMMANDERS} hint="1–2" />
                </>
              ) : (
                <>
                  <Counter label="Main" value={mainCount} ok={mainCount >= 60} hint="min 60" />
                  <Counter label="Sideboard" value={sideCount} ok={sideCount <= 15} hint="max 15" />
                </>
              )}
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="primary" size="lg" onClick={handleSave} disabled={mainCount === 0}>
                Salva mazzo
              </Button>
              <Button variant="ghost" onClick={handleCancel}>
                Annulla
              </Button>
            </div>
          </Panel>
          <div className="hidden lg:block">
            <AnimatePresence mode="wait">
              {preview && (
                <motion.div key={preview.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <CardImage card={preview} eager />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Counter({ label, value, ok, hint }: { label: string; value: number; ok: boolean; hint: string }) {
  return (
    <div className="flex items-baseline justify-between rounded-xl bg-black/25 px-3 py-2">
      <span className="text-stone-400">{label}</span>
      <span>
        <span className={`text-xl font-bold tabular-nums ${ok ? 'text-emerald-300' : 'text-gold-300'}`}>{value}</span>
        <span className="ml-1 text-xs text-stone-500">{hint}</span>
      </span>
    </div>
  );
}

interface BoardPanelProps {
  title: string;
  count: number;
  target: number;
  /** Copie massime di una carta non base (4 nel Constructed, 1 nel Commander) */
  maxCopies: number;
  emptyText?: string;
  entries: DeckEntry[];
  cards: Parameters<typeof groupByType>[1];
  onQuantity: (name: string, quantity: number) => void;
  onRemove: (name: string) => void;
  onMove: (name: string) => void;
  moveLabel: string;
  onPreview: (card: DisplayCard) => void;
}

function BoardPanel({
  title,
  count,
  target,
  maxCopies,
  emptyText = 'Nessuna carta. Cerca una carta qui sopra per aggiungerla.',
  entries,
  cards,
  onQuantity,
  onRemove,
  onMove,
  moveLabel,
  onPreview,
}: BoardPanelProps) {
  const groups = useMemo(() => groupByType(entries, cards), [entries, cards]);

  return (
    <Panel title={`${title} · ${count}${target === 60 ? '' : `/${target}`}`}>
      {entries.length === 0 ? (
        <p className="text-sm text-stone-500">{emptyText}</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.type}>
              <h3 className="mb-1 text-xs font-semibold tracking-wider text-stone-500 uppercase">
                {TYPE_LABELS[group.type]} · {group.count}
              </h3>
              <ul className="divide-y divide-white/5">
                {group.entries.map((entry) => {
                  const tooMany = entry.quantity > maxCopies && !isBasicLand(entry.card);
                  const cost = isPlaceholder(entry.card)
                    ? undefined
                    : (entry.card.mana_cost ?? entry.card.card_faces?.[0]?.mana_cost);
                  return (
                    <li
                      key={entry.name}
                      className="flex items-center gap-2 py-1.5"
                      onMouseEnter={() => onPreview(entry.card)}
                    >
                      <div className="flex items-center rounded-lg bg-black/30">
                        <QtyButton label="−" onClick={() => onQuantity(entry.name, entry.quantity - 1)} />
                        <span className={`w-7 text-center font-bold tabular-nums ${tooMany ? 'text-red-300' : 'text-gold-300'}`}>
                          {entry.quantity}
                        </span>
                        <QtyButton label="+" onClick={() => onQuantity(entry.name, entry.quantity + 1)} />
                      </div>
                      <span className={`min-w-0 flex-1 truncate text-sm ${isPlaceholder(entry.card) ? 'text-red-300' : 'text-stone-200'}`}>
                        {entry.name}
                        {tooMany && <span className="ml-2 text-xs text-red-300">max {maxCopies}</span>}
                      </span>
                      {cost && (
                        <span className="hidden sm:inline">
                          <ManaCost cost={cost} size="sm" />
                        </span>
                      )}
                      <button
                        onClick={() => onMove(entry.name)}
                        className="cursor-pointer rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-white/5 hover:text-stone-200"
                      >
                        {moveLabel}
                      </button>
                      <button
                        onClick={() => onRemove(entry.name)}
                        aria-label={`Rimuovi ${entry.name}`}
                        className="cursor-pointer rounded-md px-2 py-1 text-stone-500 hover:bg-red-500/20 hover:text-red-200"
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function QtyButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="h-7 w-7 cursor-pointer rounded-md text-stone-400 hover:bg-white/10 hover:text-white">
      {label}
    </button>
  );
}
