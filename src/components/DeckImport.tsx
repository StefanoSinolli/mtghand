import { useState, useEffect, type ChangeEvent } from 'react';
import { countCards, parseDeckList } from '../utils/deckParser';
import { searchCardByName } from '../services/scryfall';
import { createDeck } from '../services/deckStorage';
import type { Deck, DeckEntry, ScryfallCard } from '../types';
import './DeckImport.css';

interface DeckImportProps {
  onDeckImported: (deck: Deck) => void;
}

const addToList = (list: DeckEntry[], name: string, quantity: number): DeckEntry[] => {
  const existing = list.find((e) => e.name === name);
  if (existing) {
    return list.map((e) => (e === existing ? { ...e, quantity: e.quantity + quantity } : e));
  }
  return [...list, { name, quantity }];
};

export default function DeckImport({ onDeckImported }: DeckImportProps) {
  // Import tab
  const [deckName, setDeckName] = useState('');
  const [deckText, setDeckText] = useState('');
  const [error, setError] = useState('');

  // Build tab
  const [activeTab, setActiveTab] = useState<'import' | 'build'>('import');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ScryfallCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [buildDeckName, setBuildDeckName] = useState('');
  const [buildDeck, setBuildDeck] = useState<{ main: DeckEntry[]; side: DeckEntry[] }>({ main: [], side: [] });
  const [selectedQuantity, setSelectedQuantity] = useState('1');
  const [addToSideboard, setAddToSideboard] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Ricerca carte (debounced)
  useEffect(() => {
    if (activeTab !== 'build' || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      const result = await searchCardByName(searchQuery);
      if (result) {
        setSearchResults([result]);
      } else {
        setSearchError('Carta non trovata');
        setSearchResults([]);
      }
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    file.text().then(setDeckText);
    if (!deckName.trim()) setDeckName(file.name.replace(/\.(txt|dek|dec)$/i, ''));
  };

  const handleImport = () => {
    if (!deckName.trim()) {
      setError('Inserisci un nome per il mazzo');
      return;
    }

    if (!deckText.trim()) {
      setError('Inserisci o carica una decklist');
      return;
    }

    const parsed = parseDeckList(deckText);

    if (parsed.main.length === 0) {
      setError('Nessuna carta trovata nel main deck. Verifica il formato della decklist');
      return;
    }

    if (parsed.unrecognized.length > 0) {
      const lines = parsed.unrecognized.map((l) => `• ${l}`).join('\n');
      if (!confirm(`Queste righe non sono state riconosciute e verranno ignorate:\n${lines}\n\nContinuare?`)) {
        return;
      }
    }

    onDeckImported(createDeck(deckName.trim(), parsed.main, parsed.side));

    // Reset form
    setDeckName('');
    setDeckText('');
    setError('');
  };

  const handleAddCard = (card: ScryfallCard) => {
    const quantity = parseInt(selectedQuantity, 10) || 1;

    if (quantity < 1 || quantity > 4) {
      alert('Quantità deve essere tra 1 e 4');
      return;
    }

    setBuildDeck((prev) =>
      addToSideboard
        ? { ...prev, side: addToList(prev.side, card.name, quantity) }
        : { ...prev, main: addToList(prev.main, card.name, quantity) },
    );

    // Reset search
    setSearchQuery('');
    setSearchResults([]);
    setSelectedQuantity('1');
  };

  const handleRemoveCard = (index: number, isMain: boolean) => {
    setBuildDeck((prev) =>
      isMain
        ? { ...prev, main: prev.main.filter((_, i) => i !== index) }
        : { ...prev, side: prev.side.filter((_, i) => i !== index) },
    );
  };

  const mainDeckCount = countCards(buildDeck.main);
  const sideboardCount = countCards(buildDeck.side);

  const handleSaveBuildDeck = () => {
    if (!buildDeckName.trim()) {
      alert('Inserisci un nome per il mazzo');
      return;
    }

    if (mainDeckCount === 0) {
      alert('Il main deck deve contenere almeno una carta');
      return;
    }

    if (mainDeckCount < 60) {
      if (!confirm(`Il main deck ha ${mainDeckCount} carte (minimo 60). Continuare comunque?`)) {
        return;
      }
    }

    if (sideboardCount > 15) {
      alert('Il sideboard non può avere più di 15 carte');
      return;
    }

    onDeckImported(createDeck(buildDeckName.trim(), buildDeck.main, buildDeck.side));

    // Reset
    setBuildDeckName('');
    setBuildDeck({ main: [], side: [] });
    setActiveTab('import');
  };

  return (
    <div className="deck-import">
      <h2>Gestione Mazzo</h2>
      
      {/* Tab Navigation */}
      <div className="deck-tabs">
        <button 
          className={`tab-btn ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          📋 Importa da File
        </button>
        <button 
          className={`tab-btn ${activeTab === 'build' ? 'active' : ''}`}
          onClick={() => setActiveTab('build')}
        >
          🔍 Crea Mazzo
        </button>
      </div>

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="tab-content">
          <div className="form-group">
            <label htmlFor="deckName">Nome Mazzo</label>
            <input
              type="text"
              id="deckName"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="Es: Mono Red Aggro"
            />
          </div>

          <div className="form-group">
            <label htmlFor="deckFile">Carica da file (.txt, .dek)</label>
            <input
              type="file"
              id="deckFile"
              accept=".txt,.dek,.dec"
              onChange={handleFileUpload}
            />
          </div>

          <div className="form-group">
            <label htmlFor="deckText">
              Oppure incolla la decklist
              <span className="hint">Formati supportati: "4 Lightning Bolt", Arena/MTGO. Separa main e sideboard con "Sideboard" o una riga vuota</span>
            </label>
            <textarea
              id="deckText"
              value={deckText}
              onChange={(e) => setDeckText(e.target.value)}
              placeholder="4 Lightning Bolt&#10;4 Monastery Swiftspear&#10;20 Mountain&#10;&#10;Sideboard&#10;3 Smash to Smithereens&#10;2 Tormod's Crypt"
              rows={10}
            />
          </div>

          {error && <div className="error">{error}</div>}

          <button onClick={handleImport} className="btn-primary">
            Importa Mazzo
          </button>
        </div>
      )}

      {/* Build Tab */}
      {activeTab === 'build' && (
        <div className="tab-content build-deck-container">
          <div className="build-left">
            <div className="form-group">
              <label htmlFor="buildDeckName">Nome Mazzo</label>
              <input
                type="text"
                id="buildDeckName"
                value={buildDeckName}
                onChange={(e) => setBuildDeckName(e.target.value)}
                placeholder="Es: My Custom Deck"
              />
            </div>

            <div className="form-group">
              <label htmlFor="searchInput">Ricerca Carte</label>
              <input
                type="text"
                id="searchInput"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Digita il nome della carta..."
                className="search-input"
              />
            </div>

            {searching && <div className="loading">🔍 Ricerca in corso...</div>}
            {searchError && <div className="error">{searchError}</div>}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((card, idx) => (
                  <div key={idx} className="search-result-card">
                    <div className="result-info">
                      <div className="result-name">{card.name}</div>
                      <div className="result-type">{card.type_line}</div>
                      <div className="result-mana">{card.mana_cost || 'N/A'}</div>
                    </div>
                    
                    <div className="result-actions">
                      <div className="quantity-group">
                        <label>Qty:</label>
                        <input 
                          type="number" 
                          min="1" 
                          max="4"
                          value={selectedQuantity}
                          onChange={(e) => setSelectedQuantity(e.target.value)}
                          className="qty-input"
                        />
                      </div>
                      
                      <button 
                        className={`add-btn ${addToSideboard ? 'sideboard' : 'main'}`}
                        onClick={() => handleAddCard(card)}
                      >
                        ➕ {addToSideboard ? 'SB' : 'Main'}
                      </button>
                      
                      <button 
                        className="toggle-sb"
                        onClick={() => setAddToSideboard(!addToSideboard)}
                        title={addToSideboard ? 'Aggiungi a Main' : 'Aggiungi a Sideboard'}
                      >
                        {addToSideboard ? '📌' : '🔓'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deck Preview */}
          <div className="build-right">
            <div className="deck-preview">
              <div className="preview-header">
                <h3>Anteprima Mazzo</h3>
                <div className="deck-stats">
                  <span>Main: {mainDeckCount}/60</span>
                  <span>SB: {sideboardCount}/15</span>
                </div>
              </div>

              <div className="preview-section">
                <div className="section-title">Main Deck ({mainDeckCount})</div>
                <div className="cards-list">
                  {buildDeck.main.length === 0 ? (
                    <div className="empty">Nessuna carta</div>
                  ) : (
                    buildDeck.main.map((card, idx) => (
                      <div key={idx} className="deck-card-item">
                        <span className="card-qty">{card.quantity}x</span>
                        <span className="card-name">{card.name}</span>
                        <button 
                          className="remove-btn"
                          onClick={() => handleRemoveCard(idx, true)}
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="preview-section">
                <div className="section-title">Sideboard ({sideboardCount})</div>
                <div className="cards-list">
                  {buildDeck.side.length === 0 ? (
                    <div className="empty">Nessuna carta</div>
                  ) : (
                    buildDeck.side.map((card, idx) => (
                      <div key={idx} className="deck-card-item">
                        <span className="card-qty">{card.quantity}x</span>
                        <span className="card-name">{card.name}</span>
                        <button 
                          className="remove-btn"
                          onClick={() => handleRemoveCard(idx, false)}
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button 
                onClick={handleSaveBuildDeck} 
                className="btn-primary"
                disabled={mainDeckCount === 0}
              >
                💾 Salva Mazzo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
