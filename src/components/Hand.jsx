import { useState, useEffect } from 'react';
import Card from './Card';
import CardDetails from './CardDetails';
import { searchCardsByNames } from '../services/scryfall';
import { drawOpeningHand, mulligan, putCardsBottom } from '../utils/shuffle';
import './Hand.css';

export default function Hand({ deck }) {
  const [gameState, setGameState] = useState(null);
  const [cardsData, setCardsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCards, setSelectedCards] = useState([]);
  const [needsBottoming, setNeedsBottoming] = useState(false);
  const [selectedCardDetails, setSelectedCardDetails] = useState(null);

  useEffect(() => {
    initializeGame();
  }, [deck]);

  const initializeGame = async () => {
    setLoading(true);
    
    try {
      // Pesca la mano iniziale SOLO dal main deck (60 carte)
      const state = drawOpeningHand(deck.mainDeck);

      // Fetch card data PRIMA di mostrare la mano
      const uniqueCardNames = [...new Set(state.hand)];
      console.log(`Fetching ${uniqueCardNames.length} unique cards for opening hand...`);
      const cards = await searchCardsByNames(uniqueCardNames);
      
      setCardsData(cards);
      setGameState(state);
      console.log(`Loaded ${cards.length} cards successfully`);
    } catch (error) {
      console.error('Error initializing game:', error);
      // Comunque mostra la mano anche se il fetch fallisce
      const state = drawOpeningHand(deck.mainDeck);
      setGameState(state);
    } finally {
      setLoading(false);
    }
  };

  const handleMulligan = async () => {
    if (!gameState) return;

    setLoading(true);
    
    try {
      const newState = mulligan(gameState.hand, gameState.library, gameState.mulliganCount);
      
      // Fetch le nuove carte prima di mostrare la mano
      const uniqueCardNames = [...new Set(newState.hand)];
      const newCards = await searchCardsByNames(uniqueCardNames);
      setCardsData(newCards);
      
      setGameState(newState);
      setSelectedCards([]);

      if (newState.needsBottoming && newState.cardsToBottom > 0) {
        setNeedsBottoming(true);
      }
    } catch (error) {
      console.error('Error during mulligan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeep = () => {
    if (needsBottoming && gameState) {
      // Devi prima mettere le carte in fondo
      if (selectedCards.length !== gameState.cardsToBottom) {
        alert(`Seleziona ${gameState.cardsToBottom} carte da mettere in fondo`);
        return;
      }

      const result = putCardsBottom(gameState.hand, gameState.library, selectedCards);
      setGameState({
        ...gameState,
        hand: result.hand,
        library: result.library,
        needsBottoming: false
      });
      setNeedsBottoming(false);
      setSelectedCards([]);
    }
  };

  const toggleCardSelection = (index) => {
    // Se siamo in modalità mulligan, seleziona la carta
    if (needsBottoming) {
      setSelectedCards(prev => {
        if (prev.includes(index)) {
          return prev.filter(i => i !== index);
        } else {
          if (prev.length >= gameState.cardsToBottom) {
            return prev;
          }
          return [...prev, index];
        }
      });
    } else {
      // Altrimenti mostra i dettagli della carta
      const cardName = gameState.hand[index];
      const cardData = getCardData(cardName);
      setSelectedCardDetails(cardData);
    }
  };

  const getCardData = (cardName) => {
    const card = cardsData.find(c => c.name === cardName);
    
    // Se la carta non è stata trovata in Scryfall, ritorna un oggetto placeholder
    if (!card) {
      return { 
        name: cardName,
        placeholder: true 
      };
    }
    
    return card;
  };

  if (loading) {
    return <div className="hand-loading">Caricamento mano...</div>;
  }

  if (!gameState) {
    return <div className="hand-error">Errore nel caricamento della mano</div>;
  }

  return (
    <div className="hand-container">
      <div className="hand-header">
        <h2>Mano Iniziale - {deck.name}</h2>
        <div className="hand-info">
          <span>Mulligan: {gameState.mulliganCount}</span>
          <span>Carte in biblioteca: {gameState.library.length}</span>
        </div>
      </div>

      {needsBottoming && (
        <div className="bottoming-notice">
          Seleziona {gameState.cardsToBottom} carte da mettere in fondo al mazzo
          ({selectedCards.length}/{gameState.cardsToBottom} selezionate)
        </div>
      )}

      <div className="hand-cards">
        {gameState.hand.map((cardName, index) => {
          const cardData = getCardData(cardName);
          return (
            <div key={`${cardName}-${index}`} className="card-wrapper">
              <Card
                card={cardData}
                onClick={() => toggleCardSelection(index)}
                selected={selectedCards.includes(index)}
              />
              {cardData?.placeholder && (
                <div className="card-warning" title="Carta non trovata in Scryfall">⚠️</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="hand-actions">
        {!needsBottoming ? (
          <>
            <button onClick={handleMulligan} className="btn-secondary">
              Mulligan
            </button>
            <button onClick={handleKeep} className="btn-primary">
              Keep
            </button>
          </>
        ) : (
          <button 
            onClick={handleKeep} 
            className="btn-primary"
            disabled={selectedCards.length !== gameState.cardsToBottom}
          >
            Conferma ({selectedCards.length}/{gameState.cardsToBottom})
          </button>
        )}
      </div>

      {selectedCardDetails && (
        <CardDetails 
          card={selectedCardDetails} 
          onClose={() => setSelectedCardDetails(null)}
        />
      )}
    </div>
  );
}
