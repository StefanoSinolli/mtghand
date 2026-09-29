/**
 * Gestione salvataggio mazzi in LocalStorage
 * In futuro questo file sarà modificato per usare Firebase
 */

const STORAGE_KEY = 'mtg_decks';

export const saveDecks = (decks) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
};

export const getDecks = () => {
  const decks = localStorage.getItem(STORAGE_KEY);
  const parsed = decks ? JSON.parse(decks) : [];
  
  // Migrazione: converti vecchi mazzi con `cards` in `mainDeck` e `sideboard`
  return parsed.map(deck => {
    if (deck.cards && !deck.mainDeck) {
      return {
        ...deck,
        mainDeck: deck.cards,
        sideboard: [],
        stats: {
          ...deck.stats,
          mainDeckCards: deck.cards.length,
          sideboardCards: 0
        }
      };
    }
    return deck;
  });
};

export const saveDeck = (deck) => {
  const decks = getDecks();
  const existingIndex = decks.findIndex(d => d.id === deck.id);
  
  if (existingIndex >= 0) {
    decks[existingIndex] = deck;
  } else {
    decks.push(deck);
  }
  
  saveDecks(decks);
};

export const deleteDeck = (deckId) => {
  const decks = getDecks();
  const filtered = decks.filter(d => d.id !== deckId);
  saveDecks(filtered);
};

export const getDeck = (deckId) => {
  const decks = getDecks();
  return decks.find(d => d.id === deckId);
};
