import { Fragment, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router';
import { useDeckCards } from '../hooks/useDeckCards';
import { deleteDeck, useDeck } from '../store/decks';
import { formatDeckList } from '../utils/deckParser';
import { summarizeDeck } from '../utils/deckSummary';
import { getCardImage } from '../services/scryfall';
import Button from '../components/ui/Button';
import { ColorKey } from '../components/ui/ManaCost';
import { useConfirm } from '../components/ui/confirm';
import NotFoundPage from './NotFoundPage';
import type { DeckContext } from './deckContext';

const TABS = [
  { to: '', label: 'Panoramica', end: true },
  { to: 'hand', label: 'Mano' },
  { to: 'analysis', label: 'Analisi' },
  { to: 'edit', label: 'Modifica' },
];

export default function DeckLayout() {
  const { id } = useParams();
  const deck = useDeck(id);
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { cards, loading, missing, error, getCard } = useDeckCards(deck ?? null);
  const [copied, setCopied] = useState(false);

  const summary = useMemo(() => (deck ? summarizeDeck(deck, cards) : null), [deck, cards]);

  if (!deck || !summary) return <NotFoundPage message="Questo mazzo non esiste più." />;

  const art = summary.cover ? getCardImage(summary.cover, 'art_crop') : null;

  const handleExport = async () => {
    await navigator.clipboard.writeText(formatDeckList(deck.main, deck.side, deck.commanders ?? []));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Eliminare il mazzo?',
      message: `"${deck.name}" verrà eliminato definitivamente.`,
      confirmLabel: 'Elimina',
      danger: true,
    });
    if (ok) {
      deleteDeck(deck.id);
      navigate('/');
    }
  };

  const context: DeckContext = { deck, cards, loading, missing, error, getCard };

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-felt-900">
        {art && (
          <img
            src={art}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[center_30%] opacity-60"
            aria-hidden="true"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-felt-950 via-felt-950/75 to-felt-950/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-felt-950 via-transparent to-transparent" />

        <div className="relative flex flex-col gap-5 p-5 pb-0 sm:p-8 sm:pb-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {summary.colors.length > 0 && <ColorKey colorKey={summary.colors.join('')} size="lg" />}
                {deck.format === 'commander' && (
                  <span className="rounded-full bg-gold-400/90 px-2 py-0.5 text-xs font-bold text-felt-950">Commander</span>
                )}
                {deck.isTestDeck && (
                  <span className="rounded-full bg-gold-400/15 px-2 py-0.5 text-xs font-semibold text-gold-300">
                    Mazzo di prova
                  </span>
                )}
              </div>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-wide text-stone-50 sm:text-4xl">
                {deck.name}
              </h1>
              <p className="mt-1 text-sm text-stone-400">
                {summary.mainCount} carte · {summary.lands} terre
                {summary.sideCount > 0 && ` · sideboard ${summary.sideCount}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleExport}>
                {copied ? '✓ Copiata' : 'Copia lista'}
              </Button>
              <Button size="sm" variant="danger" onClick={handleDelete}>
                Elimina
              </Button>
            </div>
          </div>

          <nav className="-mx-1 flex gap-1 overflow-x-auto">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `relative shrink-0 px-3 py-3 text-sm font-semibold transition-colors sm:px-4 ${
                    isActive
                      ? 'text-gold-200 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-gold-400'
                      : 'text-stone-400 hover:text-stone-100'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* key: le sottopagine ripartono da zero cambiando mazzo */}
      <Fragment key={deck.id}>
        <Outlet context={context} />
      </Fragment>
    </div>
  );
}
