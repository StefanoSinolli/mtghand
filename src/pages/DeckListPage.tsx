import { useMemo } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { useCards } from '../hooks/useDeckCards';
import { getCardImage } from '../services/scryfall';
import { useDecks } from '../store/decks';
import { summarizeDeck, type DeckSummary } from '../utils/deckSummary';
import { ButtonLink } from '../components/ui/Button';
import { ColorKey } from '../components/ui/ManaCost';
import Logo from '../components/layout/Logo';
import type { Deck } from '../types';

export default function DeckListPage() {
  const decks = useDecks();
  const names = useMemo(() => decks.flatMap((d) => [...(d.commanders ?? []), ...d.main].map((e) => e.name)), [decks]);
  const { cards, loading } = useCards(names);

  const sorted = useMemo(() => [...decks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [decks]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-wide text-gold-gradient sm:text-4xl">I tuoi mazzi</h1>
          <p className="mt-1 text-stone-400">Pesca una mano, prova i mulligan e analizza la mana base.</p>
        </div>
        <ButtonLink to="/import">Importa lista</ButtonLink>
      </div>

      {decks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((deck, i) => (
            <motion.div
              key={deck.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <DeckTile deck={deck} summary={summarizeDeck(deck, cards)} loading={loading} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeckTile({ deck, summary, loading }: { deck: Deck; summary: DeckSummary; loading: boolean }) {
  const art = summary.cover ? getCardImage(summary.cover, 'art_crop') : null;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-felt-900 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-gold-400/50 hover:shadow-glow">
      <Link to={`/deck/${deck.id}`} className="block">
        <div className="relative aspect-[16/9] overflow-hidden bg-felt-800">
          {art ? (
            <img
              src={art}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className={`flex h-full items-center justify-center ${loading ? 'animate-pulse' : ''}`}>
              <Logo className="h-16 w-16 opacity-30" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-felt-900 via-felt-900/20 to-transparent" />
          {summary.colors.length > 0 && (
            <div className="absolute top-3 left-3 rounded-full bg-black/50 px-2 py-1 backdrop-blur">
              <ColorKey colorKey={summary.colors.join('')} />
            </div>
          )}
        </div>

        <div className="relative -mt-8 px-5 pb-4">
          <h2 className="truncate font-display text-xl font-bold tracking-wide text-stone-50">{deck.name}</h2>
          {deck.format === 'commander' && (
            <span className="absolute top-0 right-5 rounded-full bg-gold-400/90 px-2 py-0.5 text-[11px] font-bold text-felt-950">
              Commander
            </span>
          )}
          <p className="mt-1 text-sm text-stone-400">
            {summary.mainCount} carte · {summary.lands} terre
            {summary.sideCount > 0 && ` · side ${summary.sideCount}`}
          </p>
        </div>
      </Link>

      <div className="flex gap-2 border-t border-white/5 px-5 py-3">
        <ButtonLink to={`/deck/${deck.id}/hand`} variant="primary" size="sm" className="flex-1">
          Pesca una mano
        </ButtonLink>
        <ButtonLink to={`/deck/${deck.id}/analysis`} size="sm" className="flex-1">
          Analizza
        </ButtonLink>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass flex flex-col items-center gap-4 rounded-3xl px-6 py-20 text-center">
      <Logo className="h-16 w-16" />
      <h2 className="font-display text-2xl font-bold text-gold-200">Nessun mazzo</h2>
      <p className="max-w-md text-stone-400">
        Incolla una lista da Arena, MTGO o Moxfield, oppure costruisci un mazzo cercando le carte.
      </p>
      <div className="flex gap-2">
        <ButtonLink to="/import" variant="primary">
          Importa una lista
        </ButtonLink>
        <ButtonLink to="/new">Crea da zero</ButtonLink>
      </div>
    </div>
  );
}
