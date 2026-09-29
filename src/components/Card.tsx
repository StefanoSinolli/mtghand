import { useState, useRef, type MouseEvent } from 'react';
import { getCardImage } from '../services/scryfall';
import type { DisplayCard } from '../types';
import './Card.css';

interface CardProps {
  card: DisplayCard;
  onClick?: () => void;
  selected?: boolean;
}

export default function Card({ card, onClick, selected = false }: CardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const imageUrl = getCardImage(card, 'normal');

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;

    const rotateY = (mouseX / rect.width) * 20;
    const rotateX = -(mouseY / rect.height) * 20;

    setRotate({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
  };

  return (
    <div 
      ref={cardRef}
      className={`card ${selected ? 'selected' : ''}`}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      title={card?.name}
      style={{
        transform: `perspective(1200px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) scale(${selected ? 1.12 : 1})`
      }}
    >
      {imageUrl && !imageError ? (
        <>
          <img 
            src={imageUrl} 
            alt={card?.name} 
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            style={{ opacity: imageLoaded ? 1 : 0.5 }}
          />
          {!imageLoaded && <div className="card-loading">Caricamento...</div>}
        </>
      ) : (
        <div className="card-placeholder">
          <p className="card-name">{card?.name || 'Sconosciuta'}</p>
          {imageError && <p className="card-error">Immagine non disponibile</p>}
        </div>
      )}
    </div>
  );
}
