import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import HandFan from '../components/cards/HandFan';
import CardModal from '../components/cards/CardModal';
import Button from '../components/ui/Button';
import { ColorKey } from '../components/ui/ManaCost';
import {
  HAND_SIZE,
  canMulligan,
  confirmBottom,
  keep,
  mulligan,
  newGame,
  toggleBottom,
  type HandState,
} from '../game/london';
import { primaryType } from '../utils/deckSummary';
import { isPlaceholder, type DisplayCard, type ManaColor } from '../types';
import { useDeckContext } from './deckContext';

const WUBRG: ManaColor[] = ['W', 'U', 'B', 'R', 'G'];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="ml-1 hidden rounded border border-current/30 px-1.5 text-[10px] font-bold opacity-60 sm:inline">
      {children}
    </kbd>
  );
}

export default function HandPage() {
  const { deck, getCard, loading, error } = useDeckContext();
  const [game, setGame] = useState<HandState>(() => newGame(deck.main));
  const [dealKey, setDealKey] = useState(0);
  const [details, setDetails] = useState<DisplayCard | null>(null);

  const doMulligan = useCallback(() => {
    if (!canMulligan(game)) return;
    setGame((g) => mulligan(g));
    setDealKey((k) => k + 1);
  }, [game]);

  const doKeep = useCallback(() => setGame((g) => keep(g)), []);
  const doConfirm = useCallback(() => setGame((g) => confirmBottom(g)), []);
  const doNewHand = useCallback(() => {
    setGame(newGame(deck.main));
    setDealKey((k) => k + 1);
  }, [deck.main]);

  // Scorciatoie da tastiera
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (details || e.metaKey || e.ctrlKey || e.target instanceof HTMLInputElement) return;
      const key = e.key.toLowerCase();
      if (key === 'm' && game.phase === 'deciding') doMulligan();
      else if (key === 'k' && game.phase === 'deciding') doKeep();
      else if (key === 'n') doNewHand();
      else if (key === 'enter' && game.phase === 'bottoming') {
        // evita che Invio attivi anche il click sulla carta che ha il focus
        e.preventDefault();
        doConfirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, details, doMulligan, doKeep, doNewHand, doConfirm]);

  const handCards = useMemo(
    () => game.hand.map((c) => ({ uid: c.uid, card: getCard(c.name) })),
    [game.hand, getCard],
  );

  // Statistiche della mano (escluse le carte scelte per il fondo)
  const kept = handCards.filter((c) => !game.selected.includes(c.uid));
  const lands = kept.filter((c) => primaryType(c.card) === 'Land');
  const colors = new Set(
    lands.flatMap((c) => (isPlaceholder(c.card) ? [] : (c.card.produced_mana ?? []))),
  );
  const colorKey = WUBRG.filter((c) => colors.has(c)).join('');

  const toBottom = game.mulligans;
  const handSize = HAND_SIZE - game.mulligans;

  const onCardClick = (uid: string) => {
    if (game.phase === 'bottoming') {
      setGame((g) => toggleBottom(g, uid));
    } else {
      setDetails(handCards.find((c) => c.uid === uid)?.card ?? null);
    }
  };

  if (loading && handCards.every((c) => isPlaceholder(c.card))) {
    return <p className="animate-pulse py-24 text-center text-stone-400">Mescolo il mazzo…</p>;
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {error && (
        <p className="rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-200">⚠️ {error}: immagini non disponibili</p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <Stat label="Mulligan" value={game.mulligans} />
        <Stat label="Mano" value={game.phase === 'kept' ? game.hand.length : handSize} />
        <Stat label="Terre" value={lands.length} />
        <Stat label="Grimorio" value={game.library.length} />
        {colorKey && (
          <span className="glass flex h-9 items-center gap-2 rounded-full px-3">
            <span className="text-stone-400">Colori</span>
            <ColorKey colorKey={colorKey} />
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={game.phase === 'bottoming' ? 'bottom' : game.phase === 'kept' ? 'kept' : `decide-${game.mulligans}`}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          className="min-h-7 text-center"
        >
          {game.phase === 'deciding' && (
            <p className="font-display text-lg text-stone-200">
              {game.mulligans === 0
                ? 'Mano iniziale: tieni o mulligan?'
                : `Mulligan ${game.mulligans}: tieni ${handSize} carte o rimescoli?`}
            </p>
          )}
          {game.phase === 'bottoming' && (
            <p className="font-display text-lg text-gold-200">
              Scegli {toBottom} {toBottom === 1 ? 'carta' : 'carte'} da mettere in fondo ({game.selected.length}/{toBottom})
            </p>
          )}
          {game.phase === 'kept' && (
            <p className="font-display text-lg text-emerald-300">
              Mano tenuta con {game.hand.length} carte{lands.length > 0 && ` e ${lands.length} ${lands.length === 1 ? 'terra' : 'terre'}`}
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      <HandFan
        cards={handCards}
        dealKey={dealKey}
        selected={game.selected}
        selectable={game.phase === 'bottoming'}
        onCardClick={onCardClick}
      />

      <div className="sticky bottom-4 z-30 flex flex-wrap justify-center gap-3 rounded-2xl bg-felt-950/70 p-2 backdrop-blur-md">
        {game.phase === 'deciding' && (
          <>
            <Button size="lg" onClick={doMulligan} disabled={!canMulligan(game)}>
              Mulligan
              <Kbd>M</Kbd>
            </Button>
            <Button size="lg" variant="primary" onClick={doKeep}>
              Keep{game.mulligans > 0 && ` ${handSize}`}
              <Kbd>K</Kbd>
            </Button>
          </>
        )}
        {game.phase === 'bottoming' && (
          <Button
            size="lg"
            variant="primary"
            disabled={game.selected.length !== toBottom}
            onClick={doConfirm}
          >
            Conferma ({game.selected.length}/{toBottom})
            <Kbd>↵</Kbd>
          </Button>
        )}
        {game.phase === 'kept' && (
          <Button size="lg" variant="primary" onClick={doNewHand}>
            Nuova mano
            <Kbd>N</Kbd>
          </Button>
        )}
      </div>

      <p className="text-xs text-stone-500">
        {game.phase === 'bottoming' ? 'Tocca le carte per sceglierle.' : 'Tocca una carta per vederne i dettagli.'}
      </p>

      <CardModal card={details} onClose={() => setDetails(null)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="glass flex h-9 items-center gap-2 rounded-full px-3">
      <span className="text-stone-400">{label}</span>
      <motion.span
        key={value}
        initial={{ scale: 1.4, color: '#eed48a' }}
        animate={{ scale: 1, color: '#f5f5f4' }}
        className="font-bold tabular-nums"
      >
        {value}
      </motion.span>
    </span>
  );
}
