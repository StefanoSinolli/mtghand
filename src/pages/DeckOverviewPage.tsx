import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { groupByType, summarizeDeck } from '../utils/deckSummary';
import { isPlaceholder, type DisplayCard } from '../types';
import CardImage from '../components/cards/CardImage';
import CardModal from '../components/cards/CardModal';
import DeckList from '../components/cards/DeckList';
import ManaCurve from '../components/charts/ManaCurve';
import Panel from '../components/ui/Panel';
import { ButtonLink } from '../components/ui/Button';
import { useDeckContext } from './deckContext';

export default function DeckOverviewPage() {
  const { deck, cards, loading, missing } = useDeckContext();
  const [preview, setPreview] = useState<DisplayCard | null>(null);
  const [details, setDetails] = useState<DisplayCard | null>(null);

  const main = useMemo(() => groupByType(deck.main, cards), [deck, cards]);
  const side = useMemo(() => groupByType(deck.side, cards), [deck, cards]);
  const summary = useMemo(() => summarizeDeck(deck, cards), [deck, cards]);
  const shown = preview ?? summary.cover;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="min-w-0 space-y-6">
        {missing.length > 0 && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-3 text-sm text-red-200">
            Carte non trovate su Scryfall: {missing.join(', ')}. Correggi i nomi dalla scheda Modifica.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Panel title="Curva di mana" subtitle={`Costo medio ${summary.averageManaValue.toFixed(2)}`}>
            <ManaCurve curve={summary.curve} />
          </Panel>
          <Panel className="flex flex-col justify-center gap-2 sm:w-56">
            <ButtonLink to="hand" variant="primary" size="lg">
              Pesca una mano
            </ButtonLink>
            <ButtonLink to="analysis" size="lg">
              Analizza mana base
            </ButtonLink>
          </Panel>
        </div>

        <Panel title={`Main deck · ${summary.mainCount}`}>
          {loading && cards.size === 0 ? (
            <p className="animate-pulse text-stone-400">Carico le carte…</p>
          ) : (
            <DeckList groups={main} onHover={setPreview} onSelect={setDetails} />
          )}
        </Panel>

        {side.length > 0 && (
          <Panel title={`Sideboard · ${summary.sideCount}`}>
            <DeckList groups={side} onHover={setPreview} onSelect={setDetails} />
          </Panel>
        )}
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <AnimatePresence mode="wait">
            {shown && (
              <motion.div
                key={shown.name}
                initial={{ opacity: 0, y: 8, rotate: -1 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <CardImage card={shown} size="normal" eager />
                {!isPlaceholder(shown) && (
                  <p className="mt-3 text-center text-xs text-stone-500">Clicca un nome per i dettagli</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>

      <CardModal card={details} onClose={() => setDetails(null)} />
    </div>
  );
}
