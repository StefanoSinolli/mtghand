/**
 * Servizio per interagire con le API di Scryfall
 * Documentazione: https://scryfall.com/docs/api
 */

const SCRYFALL_API = 'https://api.scryfall.com';
const CACHE = new Map(); // Cache locale delle carte
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 ore
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

/**
 * Helper: sleep per aspettare
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Helper: fetch con retry
 */
const fetchWithRetry = async (url, options = {}, retries = MAX_RETRIES) => {
  try {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      // Rate limit - aspetta e riprova
      if (retries > 0) {
        await sleep(RETRY_DELAY * (MAX_RETRIES - retries + 1));
        return fetchWithRetry(url, options, retries - 1);
      }
      throw new Error('Rate limit raggiunto');
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response;
  } catch (error) {
    if (retries > 0) {
      console.warn(`Retry ${MAX_RETRIES - retries + 1}/${MAX_RETRIES} per ${url}`);
      await sleep(RETRY_DELAY);
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
};

/**
 * Cerca una carta per nome con cache
 */
export const searchCardByName = async (cardName) => {
  try {
    // Controlla cache
    const cached = CACHE.get(cardName);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    
    const response = await fetchWithRetry(
      `${SCRYFALL_API}/cards/named?fuzzy=${encodeURIComponent(cardName)}`
    );
    
    const data = await response.json();
    
    // Salva in cache
    CACHE.set(cardName, {
      data,
      expiry: Date.now() + CACHE_EXPIRY
    });
    
    return data;
  } catch (error) {
    console.warn(`Card not found: ${cardName}`, error.message);
    return null;
  }
};

/**
 * Cerca più carte in batch con retry e rate limiting
 */
export const searchCardsByNames = async (cardNames) => {
  try {
    // Scryfall accetta max 75 identifiers per richiesta
    const chunks = chunkArray(cardNames, 75);
    const results = [];
    
    for (const chunk of chunks) {
      // Filtra da cache per ridurre richieste
      const toFetch = [];
      const fromCache = [];
      
      for (const name of chunk) {
        const cached = CACHE.get(name);
        if (cached && cached.expiry > Date.now()) {
          fromCache.push(cached.data);
        } else {
          toFetch.push(name);
        }
      }
      
      // Aggiungi risultati da cache
      results.push(...fromCache);
      
      // Fetch quelli mancanti
      if (toFetch.length > 0) {
        const response = await fetchWithRetry(
          `${SCRYFALL_API}/cards/collection`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              identifiers: toFetch.map(name => ({ name }))
            })
          }
        );
        
        const data = await response.json();
        
        // Salva in cache e raccogli risultati
        for (const card of data.data) {
          CACHE.set(card.name, {
            data: card,
            expiry: Date.now() + CACHE_EXPIRY
          });
          results.push(card);
        }
      }
      
      // Rispetta il rate limit di Scryfall (100ms tra richieste)
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await sleep(100);
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error fetching cards collection:', error);
    return [];
  }
};

/**
 * Ottieni l'immagine della carta (small, normal, large, art_crop, etc.)
 * Con fallback
 */
export const getCardImage = (card, size = 'normal') => {
  if (!card) return null;
  
  // Prova diverse fonti di immagini
  const imageUrl = card?.image_uris?.[size] || 
                   card?.card_faces?.[0]?.image_uris?.[size] ||
                   card?.image_uris?.normal ||
                   card?.card_faces?.[0]?.image_uris?.normal;
  
  return imageUrl || null;
};

/**
 * Helper: divide array in chunk
 */
const chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Svuota la cache (opzionale)
 */
export const clearCache = () => {
  CACHE.clear();
};

/**
 * Ottieni statistiche della cache
 */
export const getCacheStats = () => {
  let expired = 0;
  let valid = 0;
  
  for (const [_, cached] of CACHE) {
    if (cached.expiry > Date.now()) {
      valid++;
    } else {
      expired++;
    }
  }
  
  return { valid, expired, total: CACHE.size };
};
