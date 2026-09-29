import { useState, useEffect } from 'react';
import { getCardImage } from '../services/scryfall';
import { isPlaceholder, type DisplayCard } from '../types';
import './CardDetails.css';

interface CardDetailsProps {
  card: DisplayCard;
  onClose: () => void;
}

export default function CardDetails({ card, onClose }: CardDetailsProps) {
  const [isFullscreenImage, setIsFullscreenImage] = useState(false);

  // Gestisci ESC key per chiudere fullscreen
  useEffect(() => {
    if (!isFullscreenImage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreenImage(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreenImage]);

  if (isPlaceholder(card)) {
    return (
      <div className="card-details-overlay" onClick={onClose}>
        <div className="card-details-modal" onClick={(e) => e.stopPropagation()}>
          <button className="close-btn" onClick={onClose}>✕</button>
          <div className="card-details-info">
            <h2>{card.name}</h2>
            <p>Carta non trovata su Scryfall.</p>
          </div>
        </div>
      </div>
    );
  }

  const imageUrl = getCardImage(card, 'large');
  const imageUrlArtwork = getCardImage(card, 'art_crop') ?? imageUrl ?? undefined;
  const manaCost = card.mana_cost || '';
  const type = card.type_line || '';
  const oracleText = card.oracle_text || 'No description available';
  const power = card.power;
  const toughness = card.toughness;
  const legalities = card.legalities || {};


  // Formati di interesse
  const formats = [
    { name: 'Standard', key: 'standard' },
    { name: 'Modern', key: 'modern' },
    { name: 'Pioneer', key: 'pioneer' },
    { name: 'Pauper', key: 'pauper' },
    { name: 'Commander', key: 'commander' },
    { name: 'Legacy', key: 'legacy' },
    { name: 'Vintage', key: 'vintage' }
  ];

  const getLegalityColor = (status: string) => {
    switch (status) {
      case 'legal':
        return '#10B981';
      case 'banned':
        return '#EF4444';
      case 'restricted':
        return '#D4AF37';
      default:
        return '#6B7280';
    }
  };

  return (
    <div className="card-details-overlay" onClick={onClose}>
      <div className="card-details-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>

        <div className="card-details-content">
          <div className="card-details-image">
            {imageUrl ? (
              <img 
                src={imageUrl}
                alt={card.name}
                onClick={() => setIsFullscreenImage(true)}
                style={{ cursor: 'pointer' }}
                title="Click to view fullscreen"
              />
            ) : (
              <div className="card-placeholder-large">{card.name}</div>
            )}
          </div>

          <div className="card-details-info">
            <div className="card-header">
              <h2>{card.name}</h2>
              {manaCost && <span className="mana-cost">{manaCost}</span>}
            </div>

            <div className="card-type">
              <p><strong>Type:</strong> {type}</p>
            </div>

            {oracleText && (
              <div className="card-oracle">
                <p><strong>Description:</strong></p>
                <p className="oracle-text">{oracleText}</p>
              </div>
            )}

            {(power || toughness) && (
              <div className="card-stats">
                <span className="power-toughness">
                  {power}/{toughness}
                </span>
              </div>
            )}

            <div className="card-legalities">
              <h3>Legalities</h3>
              <div className="legalities-grid">
                {formats.map(format => {
                  const status = legalities[format.key] || 'not_legal';
                  return (
                    <div key={format.key} className="legality-item">
                      <span className="format-name">{format.name}</span>
                      <span 
                        className="legality-status"
                        style={{ color: getLegalityColor(status) }}
                      >
                        {status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {card.rarity && (
              <div className="card-footer">
                <small>Rarity: {card.rarity} | Set: {card.set_name}</small>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Artwork Overlay */}
      {isFullscreenImage && (
        <div 
          className="fullscreen-artwork-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setIsFullscreenImage(false);
          }}
        >
          <button 
            className="fullscreen-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsFullscreenImage(false);
            }}
          >
            ✕
          </button>
          <img 
            src={imageUrlArtwork} 
            alt={card.name}
            className="fullscreen-artwork-image"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="fullscreen-hint">Press ESC or click to close</div>
        </div>
      )}
    </div>
  );
}
