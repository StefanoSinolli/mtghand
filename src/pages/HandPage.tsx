import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import HandFan from '../components/cards/HandFan';
import CardModal from '../components/cards/CardModal';
import Button from '../components/ui/Button';
import { ColorKey } from '../components/ui/ManaCost';
import {
  HAND_SIZE,
  canMulligan,
  cardsToBottom,
  confirmBottom,
  keep,
  mulligan,
  newGame,
  toggleBottom,
  type HandState,
} from '../game/london';
import { primaryType } from '../utils/deckSummary';
import { rulesFor } from '../formats';
import CardImage from '../components/cards/CardImage';
import PlaytestBoard from '../components/playtest/PlaytestBoard';
import { buildProfiles } from '../analysis/analyze';
import { buildCardInfo, startPlaytest, type PlayCardInfo, type PlaytestState } from '../game/playtest';
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
  const { deck, cards, getCard, loading, error } = useDeckContext();
  const rules = rulesFor(deck.format);
  const gameOptions = useMemo(() => ({ freeFirstMulligan: rules.freeFirstMulligan }), [rules.freeFirstMulligan]);
  const [game, setGame] = useState<HandState>(() => newGame(deck.main, gameOptions));
  const [dealKey, setDealKey] = useState(0);
  const [details, setDetails] = useState<DisplayCard | null>(null);
  const [playtest, setPlaytest] = useState<PlaytestState | null>(null);

  // Informazioni di gioco (terre, costi, mana prodotto) per la prova di gioco
  const infoOf = useMemo(() => {
    const { profiles, commanderProfiles } = buildProfiles(deck, cards);
    const infos = new Map<string, PlayCardInfo>();
    for (const p of [...profiles, ...commanderProfiles]) {
      const info = buildCardInfo(p, profiles);
      // stessa chiave usata dalle istanze di carta: il nome scritto nella lista
      for (const e of [...deck.main, ...(deck.commanders ?? [])]) {
        if (getCard(e.name) === p.card) infos.set(e.name, info);
      }
    }
    return (name: string) => infos.get(name);
  }, [deck, cards, getCard]);

  const startPlaying = useCallback(() => {
    setPlaytest(
      startPlaytest(game.hand, game.library, {
        drawOnFirstTurn: rules.drawOnFirstTurn,
        commanders: (deck.commanders ?? []).map((c, i) => ({ uid: `cmd-${i}`, name: c.name })),
      }),
    );
  }, [game, rules.drawOnFirstTurn, deck.commanders]);

  const doMulligan = useCallback(() => {
    if (!canMulligan(game)) return;
    setGame((g) => mulligan(g));
    setDealKey((k) => k + 1);
  }, [game]);

  const doKeep = useCallback(() => setGame((g) => keep(g)), []);
  const doConfirm = useCallback(() => setGame((g) => confirmBottom(g)), []);
  const doNewHand = useCallback(() => {
    setGame(newGame(deck.main, gameOptions));
    setPlaytest(null);
    setDealKey((k) => k + 1);
  }, [deck.main, gameOptions]);

  // Scorciatoie da tastiera
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // durante la prova di gioco le scorciatoie le gestisce il tavolo
      if (playtest || details || e.metaKey || e.ctrlKey || e.target instanceof HTMLInputElement) return;
      const key = e.key.toLowerCase();
      if (key === 'm' && game.phase === 'deciding') doMulligan();
      else if (key === 'k' && game.phase === 'deciding') doKeep();
      else if (key === 'n') doNewHand();
      else if (key === 'g' && game.phase === 'kept') startPlaying();
      else if (key === 'enter' && game.phase === 'bottoming') {
        // evita che Invio attivi anche il click sulla carta che ha il focus
        e.preventDefault();
        doConfirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, details, playtest, doMulligan, doKeep, doNewHand, doConfirm, startPlaying]);

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

  const toBottom = cardsToBottom(game);
  const handSize = HAND_SIZE - toBottom;
  const freeMulliganNow = game.freeMulligan && game.mulligans === 1;
  const commanders = (deck.commanders ?? []).map((c) => getCard(c.name));

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

  if (playtest) {
    return (
      <PlaytestBoard state={playtest} onChange={setPlaytest} onNewHand={doNewHand} getCard={getCard} infoOf={infoOf} />
    );
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

      {commanders.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold tracking-wider text-stone-500 uppercase">Zona di comando</span>
          {commanders.map((c) => (
            <button
              key={c.name}
              className="w-16 cursor-pointer transition-transform hover:-translate-y-0.5 sm:w-20"
              onClick={() => setDetails(c)}
              aria-label={`${c.name} (comandante)`}
            >
              <CardImage card={c} size="small" />
            </button>
          ))}
        </div>
      )}

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
                ? rules.freeFirstMulligan
                  ? 'Mano iniziale: tieni o mulligan? Il primo è gratuito'
                  : 'Mano iniziale: tieni o mulligan?'
                : freeMulliganNow
                  ? 'Mulligan gratuito: tieni 7 carte o rimescoli?'
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
              Keep{handSize < HAND_SIZE && ` ${handSize}`}
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
          <>
            <Button size="lg" onClick={doNewHand}>
              Nuova mano
              <Kbd>N</Kbd>
            </Button>
            <Button size="lg" variant="primary" onClick={startPlaying}>
              Gioca i turni
              <Kbd>G</Kbd>
            </Button>
          </>
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
