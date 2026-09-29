import { useState, useEffect } from 'react';
import DeckImport from './components/DeckImport';
import Hand from './components/Hand';
import Analysis from './components/Analysis';
import { saveDeck, getDecks, deleteDeck, createDeck } from './services/deckStorage';
import { countCards, parseDeckList } from './utils/deckParser';
import type { Deck } from './types';
import './App.css';

// Mazzo di test di default
const DEFAULT_TEST_DECK = `4 Lightning Bolt
4 Monastery Swiftspear
4 Eidolon of the Great Revel
4 Goblin Guide
4 Lava Spike
4 Rift Bolt
4 Skewer the Critics
2 Light Up the Stage
2 Searing Blood
2 Roiling Vortex
20 Mountain
4 Sunbaked Canyon
2 Den of the Bugbear

Sideboard
4 Smash to Smithereens
3 Pyroblast
3 Tormod's Crypt
2 Skullcrack
3 Path to Exile`;

function App() {
  const [view, setView] = useState<'decks' | 'import' | 'hand' | 'analysis'>('decks');
  const [decks, setDecks] = useState<Deck[]>([]);
  const [currentDeck, setCurrentDeck] = useState<Deck | null>(null);

  useEffect(() => {
    loadDecks();
  }, []);

  const loadDecks = () => {
    let savedDecks = getDecks();
    
    // Se non ci sono mazzi, carica il mazzo di test di default
    if (savedDecks.length === 0) {
      const parsed = parseDeckList(DEFAULT_TEST_DECK);
      const testDeck: Deck = {
        ...createDeck('🧪 Mono Red Burn (Test)', parsed.main, parsed.side),
        id: 'test-deck',
        isTestDeck: true,
      };

      saveDeck(testDeck);
      savedDecks = [testDeck];
    }
    
    setDecks(savedDecks);
  };

  const handleDeckImported = (deck: Deck) => {
    saveDeck(deck);
    loadDecks();
    setView('decks');
  };

  const handleStartGame = (deck: Deck) => {
    setCurrentDeck(deck);
    setView('hand');
  };

  const handleAnalyze = (deck: Deck) => {
    setCurrentDeck(deck);
    setView('analysis');
  };

  const handleDeckUpdated = (deck: Deck) => {
    saveDeck(deck);
    setCurrentDeck(deck);
    loadDecks();
  };

  const handleDeleteDeck = (deckId: string) => {
    if (confirm('Sei sicuro di voler eliminare questo mazzo?')) {
      deleteDeck(deckId);
      loadDecks();
    }
  };

  const handleBackToDecks = () => {
    setCurrentDeck(null);
    setView('decks');
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎴 MTG Hand Simulator</h1>
        {view !== 'decks' && (
          <button onClick={handleBackToDecks} className="btn-back">
            ← Torna ai mazzi
          </button>
        )}
      </header>

      <main className="app-main">
        {view === 'decks' && (
          <div className="decks-view">
            <div className="decks-header">
              <h2>I tuoi mazzi</h2>
              <button onClick={() => setView('import')} className="btn-primary">
                + Importa Mazzo
              </button>
            </div>

            {decks.length === 0 ? (
              <div className="empty-state">
                <p>Non hai ancora importato nessun mazzo.</p>
                <button onClick={() => setView('import')} className="btn-primary">
                  Importa il tuo primo mazzo
                </button>
              </div>
            ) : (
              <div className="decks-grid">
                {decks.map((deck) => (
                  <div key={deck.id} className="deck-card">
                    <h3>{deck.name}</h3>
                    <div className="deck-stats">
                      <span>Main: {countCards(deck.main)} carte</span>
                      {deck.side.length > 0 && (
                        <span>Side: {countCards(deck.side)}</span>
                      )}
                    </div>
                    <div className="deck-actions">
                      <button 
                        onClick={() => handleStartGame(deck)}
                        className="btn-primary"
                      >
                        Gioca
                      </button>
                      <button
                        onClick={() => handleAnalyze(deck)}
                        className="btn-secondary"
                      >
                        Analizza
                      </button>
                      <button 
                        onClick={() => handleDeleteDeck(deck.id)}
                        className="btn-danger"
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'import' && (
          <DeckImport onDeckImported={handleDeckImported} />
        )}

        {view === 'analysis' && currentDeck && (
          <Analysis
            deck={currentDeck}
            onDeckUpdated={handleDeckUpdated}
            onPlay={() => setView('hand')}
          />
        )}

        {view === 'hand' && currentDeck && (
          <Hand key={currentDeck.id} deck={currentDeck} onAnalyze={() => setView('analysis')} />
        )}
      </main>

      <footer className="app-footer">
        <p>Dati delle carte forniti da <a href="https://scryfall.com" target="_blank" rel="noreferrer">Scryfall</a></p>
      </footer>
    </div>
  );
}

export default App;
