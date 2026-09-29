/**
 * Parser per file .txt di mazzi MTG
 * Supporta formati comuni come:
 * - "4 Lightning Bolt"
 * - "4x Lightning Bolt"
 * - "Lightning Bolt x4"
 * 
 * Gestisce anche la separazione tra Main Deck e Sideboard
 */

export const parseDeckList = (text) => {
  const lines = text.split('\n');
  const mainDeck = [];
  const sideboard = [];
  let currentSection = 'main'; // 'main' o 'sideboard'
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Salta righe vuote e commenti
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
      continue;
    }
    
    // Salta header tipo "About", "Name", "Deck"
    if (trimmed.startsWith('About') || trimmed.startsWith('Name') || trimmed === 'Deck') {
      continue;
    }
    
    // Riconosci l'inizio della sideboard
    if (trimmed.toLowerCase() === 'sideboard' || trimmed.toLowerCase() === 'sideboard:') {
      currentSection = 'sideboard';
      continue;
    }
    
    // Riconosci l'inizio del main (opzionale)
    if (trimmed.toLowerCase() === 'maindeck' || trimmed.toLowerCase() === 'maindeck:' || trimmed.toLowerCase() === 'main deck' || trimmed.toLowerCase() === 'main deck:') {
      currentSection = 'main';
      continue;
    }
    
    // Salta altre sezioni tipo "Commander:"
    if (trimmed.endsWith(':')) {
      continue;
    }
    
    // Prova a parsare: "4 Lightning Bolt" o "4x Lightning Bolt"
    const match1 = trimmed.match(/^(\d+)x?\s+(.+)$/);
    if (match1) {
      const quantity = parseInt(match1[1]);
      const cardName = match1[2].trim();
      
      const targetArray = currentSection === 'sideboard' ? sideboard : mainDeck;
      for (let i = 0; i < quantity; i++) {
        targetArray.push(cardName);
      }
      continue;
    }
    
    // Prova a parsare: "Lightning Bolt x4"
    const match2 = trimmed.match(/^(.+)\s+x(\d+)$/);
    if (match2) {
      const cardName = match2[1].trim();
      const quantity = parseInt(match2[2]);
      
      const targetArray = currentSection === 'sideboard' ? sideboard : mainDeck;
      for (let i = 0; i < quantity; i++) {
        targetArray.push(cardName);
      }
      continue;
    }
    
    // Se non ha quantità, assume 1 carta
    const targetArray = currentSection === 'sideboard' ? sideboard : mainDeck;
    targetArray.push(trimmed);
  }
  
  return {
    mainDeck,
    sideboard,
    allCards: [...mainDeck, ...sideboard]
  };
};

/**
 * Conta le carte uniche nel mazzo
 */
export const getCardCounts = (cards) => {
  const counts = {};
  
  for (const card of cards) {
    counts[card] = (counts[card] || 0) + 1;
  }
  
  return counts;
};

/**
 * Ottieni statistiche del mazzo
 */
export const getDeckStats = (mainDeck, sideboard = []) => {
  const mainCounts = getCardCounts(mainDeck);
  const sideCounts = getCardCounts(sideboard);
  
  return {
    totalCards: mainDeck.length + sideboard.length,
    mainDeckCards: mainDeck.length,
    sideboardCards: sideboard.length,
    uniqueCards: Object.keys(mainCounts).length + Object.keys(sideCounts).length,
    uniqueMainCards: Object.keys(mainCounts).length,
    uniqueSideCards: Object.keys(sideCounts).length,
    mainCardCounts: mainCounts,
    sideCardCounts: sideCounts
  };
};
