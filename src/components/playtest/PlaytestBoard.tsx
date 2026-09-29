import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  availableMana,
  cast,
  discard,
  manaSources,
  nextTurn,
  playLand,
  putIntoPlay,
  toggleTap,
  undo,
  type PlayCardInfo,
  type PlaytestResult,
  type PlaytestState,
} from '../../game/playtest';
import { payCost } from '../../game/mana';
import type { CardInstance, DisplayCard } from '../../types';
import CardImage from '../cards/CardImage';
import CardModal from '../cards/CardModal';
import HandFan from '../cards/HandFan';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import ManaCost, { ColorKey } from '../ui/ManaCost';

interface PlaytestBoardProps {
  state: PlaytestState;
  onChange: (state: PlaytestState) => void;
  onNewHand: () => void;
  getCard: (name: string) => DisplayCard;
  infoOf: (name: string) => PlayCardInfo | undefined;
}

type Selection = { card: CardInstance; zone: 'hand' | 'battlefield' | 'command' } | null;

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="ml-1 hidden rounded border border-current/30 px-1.5 text-[10px] font-bold opacity-60 sm:inline">
      {children}
    </kbd>
  );
}

/** Tavolo della prova di gioco: campo, zona di comando, mano, cimitero e registro */
export default function PlaytestBoard({ state, onChange, onNewHand, getCard, infoOf }: PlaytestBoardProps) {
  const [selected, setSelected] = useState<Selection>(null);
  const [details, setDetails] = useState<DisplayCard | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showGraveyard, setShowGraveyard] = useState(false);

  const mana = availableMana(state, infoOf);
  const lands = state.battlefield.filter((c) => c.asLand);
  const permanents = state.battlefield.filter((c) => !c.asLand);
  const handCards = useMemo(() => state.hand.map((c) => ({ uid: c.uid, card: getCard(c.name) })), [state.hand, getCard]);

  const apply = (result: PlaytestResult) => {
    if (result.ok) {
      onChange(result.state);
      setSelected(null);
      setMessage(null);
    } else {
      setMessage(result.reason);
    }
  };

  // Scorciatoie: Spazio turno successivo, Z annulla, N nuova mano
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (selected || details || e.metaKey || e.ctrlKey || e.target instanceof HTMLInputElement) return;
      const key = e.key.toLowerCase();
      if (key === ' ') {
        e.preventDefault();
        onChange(nextTurn(state));
      } else if (key === 'z') onChange(undo(state));
      else if (key === 'n') onNewHand();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, selected, details, onChange, onNewHand]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="glass sticky top-20 z-30 flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <span className="font-display text-lg font-bold text-gold-200">Turno {state.turn}</span>
          <span className="flex items-center gap-2">
            <span className="text-stone-400">Mana</span>
            <span className="font-bold tabular-nums">{mana.total}</span>
            {mana.colors.length > 0 && <ColorKey colorKey={mana.colors.join('')} size="sm" />}
          </span>
          <span className="text-stone-400">
            Grimorio <strong className="text-stone-100 tabular-nums">{state.library.length}</strong>
          </span>
          <button
            className="cursor-pointer text-stone-400 hover:text-stone-100"
            onClick={() => setShowGraveyard((v) => !v)}
          >
            Cimitero <strong className="text-stone-100 tabular-nums">{state.graveyard.length}</strong>
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => onChange(undo(state))} disabled={state.history.length === 0}>
            Annulla
            <Kbd>Z</Kbd>
          </Button>
          <Button size="sm" onClick={onNewHand}>
            Nuova mano
            <Kbd>N</Kbd>
          </Button>
          <Button size="sm" variant="primary" onClick={() => onChange(nextTurn(state))}>
            Turno successivo
            <Kbd>Spazio</Kbd>
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {message && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-200"
          >
            {message}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="grid w-full gap-4 lg:grid-cols-[1fr_240px]">
        <section className="min-h-48 space-y-4 rounded-3xl border border-white/10 bg-felt-800/40 p-4">
          <Zone title="Permanenti" empty="Nessun permanente in gioco">
            {permanents.map((c) => (
              <BattlefieldCard key={c.uid} name={c.name} tapped={c.tapped} card={getCard(c.name)} onClick={() => setSelected({ card: c, zone: 'battlefield' })} />
            ))}
          </Zone>
          <Zone title={`Terre · ${lands.length}`} empty="Nessuna terra in gioco">
            {lands.map((c) => (
              <BattlefieldCard key={c.uid} name={c.name} tapped={c.tapped} small card={getCard(c.name)} onClick={() => setSelected({ card: c, zone: 'battlefield' })} />
            ))}
          </Zone>
        </section>

        <aside className="space-y-4">
          {state.commandZone.length > 0 && (
            <div className="glass rounded-2xl p-3">
              <h3 className="mb-2 text-xs font-semibold tracking-wider text-stone-500 uppercase">Zona di comando</h3>
              <div className="flex gap-2">
                {state.commandZone.map((c) => (
                  <button key={c.uid} className="w-20 cursor-pointer" onClick={() => setSelected({ card: c, zone: 'command' })}>
                    <CardImage card={getCard(c.name)} size="small" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {showGraveyard && (
            <div className="glass rounded-2xl p-3 text-sm">
              <h3 className="mb-1 text-xs font-semibold tracking-wider text-stone-500 uppercase">Cimitero</h3>
              {state.graveyard.length === 0 ? (
                <p className="text-stone-500">Vuoto</p>
              ) : (
                <ul className="space-y-0.5">
                  {state.graveyard.map((c) => (
                    <li key={c.uid}>
                      <button className="cursor-pointer text-stone-300 hover:text-white" onClick={() => setDetails(getCard(c.name))}>
                        {c.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="glass rounded-2xl p-3 text-xs">
            <h3 className="mb-1 font-semibold tracking-wider text-stone-500 uppercase">Registro</h3>
            <ul className="space-y-0.5 text-stone-400">
              {state.log.slice(-8).reverse().map((line, i) => (
                <li key={`${state.log.length}-${i}`} className={i === 0 ? 'text-stone-200' : ''}>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <HandFan
        cards={handCards}
        dealKey={0}
        selected={[]}
        selectable={false}
        onCardClick={(uid) => {
          const card = state.hand.find((c) => c.uid === uid);
          if (card) setSelected({ card, zone: 'hand' });
        }}
      />
      <p className="text-xs text-stone-500">Tocca una carta per giocarla. Le carte in campo si tappano e stappano con un tocco.</p>

      <Modal open={selected !== null} onClose={() => setSelected(null)} className="w-full max-w-md p-5" label="Azioni">
        {selected && (
          <CardActions
            selection={selected}
            state={state}
            info={infoOf(selected.card.name)}
            card={getCard(selected.card.name)}
            infoOf={infoOf}
            onApply={apply}
            onToggleTap={() => {
              onChange(toggleTap(state, selected.card.uid));
              setSelected(null);
            }}
            onDetails={() => {
              setDetails(getCard(selected.card.name));
              setSelected(null);
            }}
          />
        )}
      </Modal>
      <CardModal card={details} onClose={() => setDetails(null)} />
    </div>
  );
}

function Zone({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold tracking-wider text-stone-500 uppercase">{title}</h3>
      {children.length === 0 ? (
        <p className="text-sm text-stone-600">{empty}</p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">{children}</div>
      )}
    </div>
  );
}

function BattlefieldCard({
  card,
  name,
  tapped,
  small = false,
  onClick,
}: {
  card: DisplayCard;
  name: string;
  tapped: boolean;
  small?: boolean;
  onClick: () => void;
}) {
  const width = small ? 64 : 88;
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      aria-label={`${name}${tapped ? ' (tappata)' : ''}`}
      className="relative cursor-pointer"
      // una carta tappata occupa lo spazio in orizzontale
      style={{ width: tapped ? width * (680 / 488) : width, height: width * (680 / 488) }}
      onClick={onClick}
    >
      <motion.div
        className="absolute top-0 left-0 origin-center"
        style={{ width }}
        animate={{ rotate: tapped ? 90 : 0, x: tapped ? (width * (680 / 488) - width) / 2 : 0, opacity: tapped ? 0.7 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      >
        <CardImage card={card} size="small" />
      </motion.div>
    </motion.button>
  );
}

interface CardActionsProps {
  selection: NonNullable<Selection>;
  state: PlaytestState;
  info: PlayCardInfo | undefined;
  card: DisplayCard;
  infoOf: (name: string) => PlayCardInfo | undefined;
  onApply: (result: PlaytestResult) => void;
  onToggleTap: () => void;
  onDetails: () => void;
}

function CardActions({ selection, state, info, card, infoOf, onApply, onToggleTap, onDetails }: CardActionsProps) {
  const { card: instance, zone } = selection;
  const inPlay = zone === 'battlefield';
  const tapped = state.battlefield.find((c) => c.uid === instance.uid)?.tapped;

  const canPlayLand = zone === 'hand' && info?.land !== undefined;
  const landReason = state.landPlayed ? 'Hai già giocato una terra in questo turno' : null;
  const canPay =
    info?.cost && payCost(info.cost.pips, info.cost.generic, manaSources(state, infoOf)) !== null;

  return (
    <div className="flex gap-4">
      <div className="w-28 shrink-0">
        <CardImage card={card} size="normal" eager />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-6">
        <h2 className="font-display text-lg font-bold text-gold-200">{instance.name}</h2>
        {inPlay ? (
          <Button onClick={onToggleTap}>{tapped ? 'Stappa' : 'Tappa'}</Button>
        ) : (
          <>
            {canPlayLand && (
              <Button variant="primary" disabled={landReason !== null} onClick={() => onApply(playLand(state, instance.uid, infoOf))}>
                Gioca terra
              </Button>
            )}
            {canPlayLand && landReason && <p className="text-xs text-stone-500">{landReason}</p>}
            {info?.cost && (
              <Button
                variant={canPlayLand ? 'secondary' : 'primary'}
                disabled={!canPay}
                onClick={() => onApply(cast(state, instance.uid, infoOf))}
              >
                Lancia <ManaCost cost={info.cost.text} size="sm" />
              </Button>
            )}
            {info?.cost && !canPay && <p className="text-xs text-stone-500">Mana o colori insufficienti</p>}
            {!info?.land && (
              <Button variant="ghost" onClick={() => onApply(putIntoPlay(state, instance.uid, infoOf))}>
                Risolvi senza pagare
              </Button>
            )}
            {zone === 'hand' && (
              <Button variant="ghost" onClick={() => onApply(discard(state, instance.uid))}>
                Scarta
              </Button>
            )}
          </>
        )}
        <Button variant="ghost" size="sm" onClick={onDetails}>
          Dettagli
        </Button>
      </div>
    </div>
  );
}
