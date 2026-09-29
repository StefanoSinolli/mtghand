/**
 * Utility per shuffle e gestione mano
 */

/**
 * Shuffle un array usando l'algoritmo Fisher-Yates
 */
export const shuffle = (array) => {
  const shuffled = [...array];
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
};

/**
 * Pesca le prime N carte dal mazzo
 */
export const drawCards = (deck, count) => {
  return deck.slice(0, count);
};

/**
 * Rimuovi le carte pescate dal mazzo
 */
export const removeDrawnCards = (deck, count) => {
  return deck.slice(count);
};

/**
 * Pesca la mano iniziale (7 carte)
 */
export const drawOpeningHand = (deck) => {
  const shuffledDeck = shuffle(deck);
  const hand = drawCards(shuffledDeck, 7);
  const library = removeDrawnCards(shuffledDeck, 7);
  
  return {
    hand,
    library,
    mulliganCount: 0
  };
};

/**
 * Esegui mulligan (London Mulligan rule)
 * - Rimescola tutta la mano
 * - Pesca 7 carte
 * - Alla fine metti in fondo N carte dove N = numero di mulligan
 */
export const mulligan = (hand, library, mulliganCount) => {
  // Rimetti la mano nel mazzo
  const fullDeck = [...hand, ...library];
  
  // Shuffle e pesca 7
  const shuffledDeck = shuffle(fullDeck);
  const newHand = drawCards(shuffledDeck, 7);
  const newLibrary = removeDrawnCards(shuffledDeck, 7);
  
  return {
    hand: newHand,
    library: newLibrary,
    mulliganCount: mulliganCount + 1,
    needsBottoming: true, // Indica che dobbiamo mettere carte in fondo
    cardsToBottom: mulliganCount + 1
  };
};

/**
 * Metti carte in fondo al library (per London Mulligan)
 */
export const putCardsBottom = (hand, library, cardIndexes) => {
  const cardsToBottom = cardIndexes.map(i => hand[i]);
  const remainingHand = hand.filter((_, i) => !cardIndexes.includes(i));
  const newLibrary = [...library, ...cardsToBottom];
  
  return {
    hand: remainingHand,
    library: newLibrary
  };
};
