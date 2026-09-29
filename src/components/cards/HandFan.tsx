import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useElementWidth } from '../../hooks/useElementWidth';
import type { DisplayCard } from '../../types';
import CardImage from './CardImage';

export interface FanCard {
  uid: string;
  card: DisplayCard;
}

interface HandFanProps {
  cards: FanCard[];
  /** Cambia a ogni nuova pescata: fa ripartire l'animazione di distribuzione */
  dealKey: number;
  selected: string[];
  selectable: boolean;
  onCardClick: (uid: string) => void;
}

const CARD_RATIO = 680 / 488;

/**
 * Mano di carte disposta a ventaglio
 */
export default function HandFan({ cards, dealKey, selected, selectable, onCardClick }: HandFanProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hovered, setHovered] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const n = Math.max(cards.length, 1);
  const compact = width < 640;
  const overlap = compact ? 0.52 : 0.62; // frazione di carta tra un centro e l'altro
  const spread = Math.min(6, 36 / n);
  // Larghezza della carta: il ventaglio (sovrapposizione + rotazione delle carte esterne) deve stare nel contenitore
  const maxAngle = (spread * (n - 1) * Math.PI) / 360;
  const span = 1 + (n - 1) * overlap + CARD_RATIO * Math.sin(maxAngle);
  const cardWidth = Math.max(64, Math.min(230, width / span));
  const cardHeight = cardWidth * CARD_RATIO;

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height: cardHeight + (compact ? 48 : 80) }}>
      {width > 0 && (
        <AnimatePresence>
          {cards.map(({ uid, card }, i) => {
            const offset = i - (cards.length - 1) / 2;
            const isSelected = selected.includes(uid);
            const isHovered = hovered === uid;
            const x = offset * cardWidth * overlap;
            const baseY = Math.abs(offset) ** 2 * (compact ? 2.5 : 5) + 16;
            const y = isSelected ? baseY + cardHeight * 0.18 : isHovered ? baseY - 36 : baseY;

            return (
              <motion.button
                key={`${dealKey}-${uid}`}
                type="button"
                aria-label={card.name}
                aria-pressed={selectable ? isSelected : undefined}
                className="absolute top-0 left-1/2 cursor-pointer rounded-[4.75%/3.4%] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                style={{ width: cardWidth, marginLeft: -cardWidth / 2, zIndex: isHovered ? 100 : i, originY: 1 }}
                initial={reduceMotion ? false : { x: 0, y: -cardHeight * 1.2, rotate: -8, opacity: 0, scale: 0.8 }}
                animate={{
                  x,
                  y,
                  rotate: isHovered ? 0 : offset * spread,
                  scale: isHovered && !compact ? 1.12 : 1,
                  opacity: 1,
                }}
                exit={reduceMotion ? { opacity: 0 } : { y: -cardHeight, opacity: 0, rotate: 0, transition: { duration: 0.25 } }}
                transition={{
                  type: 'spring',
                  stiffness: 260,
                  damping: 24,
                  delay: hovered === null && !isSelected ? i * 0.07 : 0,
                }}
                onHoverStart={() => setHovered(uid)}
                onHoverEnd={() => setHovered((h) => (h === uid ? null : h))}
                onClick={() => onCardClick(uid)}
              >
                <CardImage
                  card={card}
                  eager
                  className={`transition-[filter,box-shadow] duration-200 ${
                    isSelected ? 'shadow-glow brightness-50 grayscale-[0.4]' : ''
                  }`}
                />
                {isSelected && (
                  <span className="absolute inset-x-0 top-1/3 mx-auto w-fit rounded-full bg-gold-400 px-3 py-1 text-xs font-bold text-felt-950 shadow-lg">
                    In fondo
                  </span>
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
      )}
    </div>
  );
}
