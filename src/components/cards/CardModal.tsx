import { useState } from 'react';
import { isPlaceholder, type DisplayCard } from '../../types';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import ManaCost, { ManaText } from '../ui/ManaCost';
import CardImage from './CardImage';

const FORMATS = [
  ['standard', 'Standard'],
  ['pioneer', 'Pioneer'],
  ['modern', 'Modern'],
  ['legacy', 'Legacy'],
  ['vintage', 'Vintage'],
  ['pauper', 'Pauper'],
  ['commander', 'Commander'],
] as const;

const LEGALITY_STYLE: Record<string, string> = {
  legal: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  banned: 'bg-red-500/15 text-red-300 border-red-400/30',
  restricted: 'bg-gold-500/15 text-gold-300 border-gold-400/30',
};

interface CardModalProps {
  card: DisplayCard | null;
  onClose: () => void;
}

export default function CardModal({ card, onClose }: CardModalProps) {
  return (
    <Modal open={card !== null} onClose={onClose} className="w-full max-w-4xl" label={card?.name}>
      {card && <CardModalContent key={card.name} card={card} />}
    </Modal>
  );
}

function CardModalContent({ card }: { card: DisplayCard }) {
  const [face, setFace] = useState(0);

  if (isPlaceholder(card)) {
    return (
      <div className="p-8">
        <h2 className="font-display text-2xl font-bold text-gold-200">{card.name}</h2>
        <p className="mt-2 text-stone-400">Questa carta non è stata trovata su Scryfall. Controlla il nome nella lista.</p>
      </div>
    );
  }

  const faces = card.card_faces ?? [];
  const hasFaceImages = faces.length > 1 && faces.every((f) => f.image_uris);
  const texts = faces.length > 0 ? faces : [card];

  return (
    <div className="grid gap-6 p-5 sm:p-8 md:grid-cols-[minmax(0,340px)_1fr]">
      <div className="mx-auto w-full max-w-[340px]">
        <CardImage card={card} size="large" face={hasFaceImages ? face : 0} eager />
        {hasFaceImages && (
          <Button className="mt-3 w-full" onClick={() => setFace((f) => (f + 1) % faces.length)}>
            ↻ Gira la carta
          </Button>
        )}
      </div>

      <div className="min-w-0 space-y-5">
        {texts.map((t, i) => (
          <div key={i} className={i > 0 ? 'border-t border-white/10 pt-5' : ''}>
            <div className="flex flex-wrap items-center justify-between gap-2 pr-10">
              <h2 className="font-display text-2xl font-bold text-gold-200">{t.name}</h2>
              {t.mana_cost && <ManaCost cost={t.mana_cost} size="lg" />}
            </div>
            <p className="mt-1 text-sm font-medium text-stone-400">{t.type_line}</p>
            {t.oracle_text && (
              <div className="mt-3 space-y-2 leading-relaxed whitespace-pre-line text-stone-200">
                <ManaText text={t.oracle_text} />
              </div>
            )}
            {t.power !== undefined && (
              <p className="mt-3 inline-block rounded-lg bg-white/5 px-3 py-1 font-bold">
                {t.power}/{t.toughness}
              </p>
            )}
          </div>
        ))}

        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wider text-stone-500 uppercase">Legalità</h3>
          <div className="flex flex-wrap gap-1.5">
            {FORMATS.map(([key, label]) => {
              const status = card.legalities?.[key] ?? 'not_legal';
              return (
                <span
                  key={key}
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${LEGALITY_STYLE[status] ?? 'border-white/10 text-stone-500'}`}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>

        {card.set_name && (
          <p className="text-xs text-stone-500">
            {card.set_name} · {card.rarity}
          </p>
        )}
      </div>
    </div>
  );
}
