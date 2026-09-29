import { useState, useEffect } from 'react';
import { parseDeckList, getDeckStats } from '../utils/deckParser';
import { searchCardByName } from '../services/scryfall';
import './DeckImport.css';

export default function DeckImport({ onDeckImported }) {
  // Import tab
  const [deckName, setDeckName] = useState('');
  const [deckText, setDeckText] = useState('');
  const [error, setError] = useState('');
  
  // Build tab
  const [activeTab, setActiveTab] = useState('import'); // 'import' or 'build'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [buildDeckName, setBuildDeckName] = useState('');
  const [buildDeck, setBuildDeck] = useState({ mainDeck: [], sideboard: [] });
  const [selectedQuantity, setSelectedQuantity] = useState(1);
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
      try {
        const result = await searchCardByName(searchQuery);
        if (result) {
          setSearchResults([result]);
        } else {
          setSearchError('Carta non trovata');
          setSearchResults([]);
        }
      } catch (err) {
        setSearchError('Errore nella ricerca');
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setDeckText(event.target?.result || '');
    };
    reader.readAsText(file);
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

    try {
      const parsed = parseDeckList(deckText);
      
      if (parsed.mainDeck.length === 0) {
        setError('Nessuna carta trovata nel main deck. Verifica il formato della decklist');
        return;
      }

      const stats = getDeckStats(parsed.mainDeck, parsed.sideboard);

      const deck = {
        id: Date.now().toString(),
        name: deckName,
        mainDeck: parsed.mainDeck,
        sideboard: parsed.sideboard,
        stats,
        createdAt: new Date().toISOString()
      };

      onDeckImported(deck);
      
      // Reset form
      setDeckName('');
      setDeckText('');
      setError('');
    } catch (err) {
      setError('Errore durante l\'importazione del mazzo');
      console.error(err);
    }
  };

  const handleAddCard = (card) => {
    const quantity = parseInt(selectedQuantity) || 1;
    
    if (quantity < 1 || quantity > 4) {
      alert('Quantità deve essere tra 1 e 4');
      return;
    }

    const cardEntry = {
      name: card.name,
      quantity: quantity
    };

    if (addToSideboard) {
      setBuildDeck(prev => ({
        ...prev,
        sideboard: [...prev.sideboard, cardEntry]
      }));
    } else {
      setBuildDeck(prev => ({
        ...prev,
        mainDeck: [...prev.mainDeck, cardEntry]
      }));
    }

    // Reset search
    setSearchQuery('');
    setSearchResults([]);
    setSelectedQuantity(1);
  };

  const handleRemoveCard = (index, isDeck) => {
    if (isDeck) {
      setBuildDeck(prev => ({
        ...prev,
        mainDeck: prev.mainDeck.filter((_, i) => i !== index)
      }));
    } else {
      setBuildDeck(prev => ({
        ...prev,
        sideboard: prev.sideboard.filter((_, i) => i !== index)
      }));
    }
  };

  const handleSaveBuildDeck = () => {
    if (!buildDeckName.trim()) {
      alert('Inserisci un nome per il mazzo');
      return;
    }

    const mainDeckCount = buildDeck.mainDeck.reduce((sum, card) => sum + card.quantity, 0);
    const sideboardCount = buildDeck.sideboard.reduce((sum, card) => sum + card.quantity, 0);

    if (mainDeckCount === 0) {
      alert('Il main deck deve contenere almeno una carta');
      return;
    }

    if (mainDeckCount !== 60) {
      if (!confirm(`Il main deck ha ${mainDeckCount} carte (dovrebbe avere 60). Continuare comunque?`)) {
        return;
      }
    }

    if (sideboardCount > 15) {
      alert('Il sideboard non può avere più di 15 carte');
      return;
    }

    const deck = {
      id: Date.now().toString(),
      name: buildDeckName,
      mainDeck: buildDeck.mainDeck,
      sideboard: buildDeck.sideboard,
      stats: {
        totalCards: mainDeckCount + sideboardCount,
        mainDeckCards: mainDeckCount,
        sideboardCards: sideboardCount
      },
      createdAt: new Date().toISOString()
    };

    onDeckImported(deck);
    
    // Reset
    setBuildDeckName('');
    setBuildDeck({ mainDeck: [], sideboard: [] });
    setActiveTab('import');
  };

  const mainDeckCount = buildDeck.mainDeck.reduce((sum, card) => sum + card.quantity, 0);
  const sideboardCount = buildDeck.sideboard.reduce((sum, card) => sum + card.quantity, 0);

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
            <label htmlFor="deckFile">Carica da file .txt</label>
            <input
              type="file"
              id="deckFile"
              accept=".txt"
              onChange={handleFileUpload}
            />
          </div>

          <div className="form-group">
            <label htmlFor="deckText">
              Oppure incolla la decklist
              <span className="hint">Formato: "4 Lightning Bolt". Separa main deck e sideboard con "Sideboard"</span>
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
                  {buildDeck.mainDeck.length === 0 ? (
                    <div className="empty">Nessuna carta</div>
                  ) : (
                    buildDeck.mainDeck.map((card, idx) => (
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
                  {buildDeck.sideboard.length === 0 ? (
                    <div className="empty">Nessuna carta</div>
                  ) : (
                    buildDeck.sideboard.map((card, idx) => (
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
