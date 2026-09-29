import { useState } from 'react';
import { getCardImage } from '../../services/scryfall';
import { isPlaceholder, type DisplayCard, type ScryfallImageUris } from '../../types';

interface CardImageProps {
  card: DisplayCard;
  size?: keyof ScryfallImageUris;
  /** Indice della faccia per le carte bifronte */
  face?: number;
  className?: string;
  eager?: boolean;
}

const faceImage = (card: DisplayCard, size: keyof ScryfallImageUris, face: number) => {
  if (isPlaceholder(card)) return null;
  if (face > 0) return card.card_faces?.[face]?.image_uris?.[size] ?? null;
  return getCardImage(card, size);
};

/**
 * Immagine di una carta con proporzioni reali, skeleton durante il caricamento
 * e cornice con il nome se l'immagine non è disponibile
 */
export default function CardImage({ card, size = 'normal', face = 0, className = '', eager = false }: CardImageProps) {
  const url = faceImage(card, size, face);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`relative aspect-[488/680] overflow-hidden rounded-[4.75%/3.4%] bg-felt-800 shadow-card ${className}`}
    >
      {url && !failed ? (
        <>
          {!loaded && (
            <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.07),transparent)] bg-[length:200%_100%]" />
          )}
          <img
            src={url}
            alt={card.name}
            loading={eager ? 'eager' : 'lazy'}
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 border-4 border-stone-700 bg-gradient-to-b from-stone-800 to-stone-900 p-3 text-center">
          <span className="font-display text-sm font-bold text-stone-200">{card.name}</span>
          <span className="text-xs text-stone-500">
            {isPlaceholder(card) ? 'Carta non trovata' : 'Immagine non disponibile'}
          </span>
        </div>
      )}
    </div>
  );
}
