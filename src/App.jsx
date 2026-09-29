import { useState, useEffect } from 'react';
import DeckImport from './components/DeckImport';
import Hand from './components/Hand';
import { saveDeck, getDecks, deleteDeck } from './services/deckStorage';
import { parseDeckList, getDeckStats } from './utils/deckParser';
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
  const [view, setView] = useState('decks'); // 'decks' | 'import' | 'hand'
  const [decks, setDecks] = useState([]);
  const [currentDeck, setCurrentDeck] = useState(null);

  useEffect(() => {
    loadDecks();
  }, []);

  const loadDecks = () => {
    let savedDecks = getDecks();
    
    // Se non ci sono mazzi, carica il mazzo di test di default
    if (savedDecks.length === 0) {
      const parsed = parseDeckList(DEFAULT_TEST_DECK);
      const stats = getDeckStats(parsed.mainDeck, parsed.sideboard);
      
      const testDeck = {
        id: 'test-deck',
        name: '🧪 Mono Red Burn (Test)',
        mainDeck: parsed.mainDeck,
        sideboard: parsed.sideboard,
        stats,
        createdAt: new Date().toISOString(),
        isTestDeck: true
      };
      
      saveDeck(testDeck);
      savedDecks = [testDeck];
    }
    
    setDecks(savedDecks);
  };

  const handleDeckImported = (deck) => {
    saveDeck(deck);
    loadDecks();
    setView('decks');
  };

  const handleStartGame = (deck) => {
    setCurrentDeck(deck);
    setView('hand');
  };

  const handleDeleteDeck = (deckId) => {
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
                      <span>Main: {deck.stats.mainDeckCards} carte</span>
                      {deck.stats.sideboardCards > 0 && (
                        <span>Side: {deck.stats.sideboardCards}</span>
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

        {view === 'hand' && currentDeck && (
          <Hand deck={currentDeck} />
        )}
      </main>

      <footer className="app-footer">
        <p>Dati delle carte forniti da <a href="https://scryfall.com" target="_blank">Scryfall</a></p>
      </footer>
    </div>
  );
}

export default App;
