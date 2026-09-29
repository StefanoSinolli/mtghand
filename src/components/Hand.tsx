import { useState } from 'react';
import Card from './Card';
import CardDetails from './CardDetails';
import { useDeckCards } from '../hooks/useDeckCards';
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
import { isPlaceholder, type Deck, type DisplayCard } from '../types';
import './Hand.css';

interface HandProps {
  deck: Deck;
  onAnalyze: () => void;
}

export default function Hand({ deck, onAnalyze }: HandProps) {
  const { loading, error, missing, getCard } = useDeckCards(deck);
  const [game, setGame] = useState<HandState>(() => newGame(deck.main));
  const [detailsCard, setDetailsCard] = useState<DisplayCard | null>(null);

  if (loading) {
    return <div className="hand-loading">Caricamento carte...</div>;
  }

  const handleCardClick = (uid: string, name: string) => {
    if (game.phase === 'bottoming') {
      setGame(toggleBottom(game, uid));
    } else {
      setDetailsCard(getCard(name));
    }
  };

  const toBottom = game.mulligans;

  return (
    <div className="hand-container">
      <div className="hand-header">
        <h2>Mano Iniziale - {deck.name}</h2>
        <div className="hand-info">
          <span>Mulligan: {game.mulligans}</span>
          <span>Carte in mano: {game.phase === 'bottoming' ? game.hand.length - toBottom : game.hand.length}</span>
          <span>Carte in biblioteca: {game.library.length}</span>
        </div>
        <button className="btn-secondary btn-analyze" onClick={onAnalyze}>
          📊 Analizza mana base
        </button>
      </div>

      {error && <div className="bottoming-notice">⚠️ {error}: le immagini non sono disponibili</div>}
      {missing.length > 0 && (
        <div className="bottoming-notice">⚠️ Carte non trovate su Scryfall: {missing.join(', ')}</div>
      )}

      {game.phase === 'bottoming' && (
        <div className="bottoming-notice">
          Seleziona {toBottom} {toBottom === 1 ? 'carta' : 'carte'} da mettere in fondo al mazzo (
          {game.selected.length}/{toBottom})
        </div>
      )}

      <div className="hand-cards">
        {game.hand.map((instance) => {
          const cardData = getCard(instance.name);
          return (
            <div key={instance.uid} className="card-wrapper">
              <Card
                card={cardData}
                onClick={() => handleCardClick(instance.uid, instance.name)}
                selected={game.selected.includes(instance.uid)}
              />
              {isPlaceholder(cardData) && (
                <div className="card-warning" title="Carta non trovata in Scryfall">
                  ⚠️
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="hand-actions">
        {game.phase === 'deciding' && (
          <>
            <button onClick={() => setGame(mulligan(game))} className="btn-secondary" disabled={!canMulligan(game)}>
              Mulligan
            </button>
            <button onClick={() => setGame(keep(game))} className="btn-primary">
              Keep{game.mulligans > 0 ? ` (tieni ${HAND_SIZE - game.mulligans})` : ''}
            </button>
          </>
        )}

        {game.phase === 'bottoming' && (
          <button
            onClick={() => setGame(confirmBottom(game))}
            className="btn-primary"
            disabled={game.selected.length !== toBottom}
          >
            Conferma ({game.selected.length}/{toBottom})
          </button>
        )}

        {game.phase === 'kept' && (
          <button onClick={() => setGame(newGame(deck.main))} className="btn-primary">
            Nuova mano
          </button>
        )}
      </div>

      {detailsCard && <CardDetails card={detailsCard} onClose={() => setDetailsCard(null)} />}
    </div>
  );
}
