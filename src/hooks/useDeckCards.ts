import { useCallback, useEffect, useState } from 'react';
import { fetchCards, lookupCard } from '../services/scryfall';
import type { Deck, DisplayCard, ScryfallCard } from '../types';

interface DeckCardsState {
  cards: Map<string, ScryfallCard>;
  missing: string[];
  loading: boolean;
  error: string | null;
}

/**
 * Carica da Scryfall i dati di tutte le carte del mazzo (main + sideboard)
 */
export const useDeckCards = (deck: Deck | null) => {
  const [state, setState] = useState<DeckCardsState>({
    cards: new Map(),
    missing: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!deck) return;

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const names = [...deck.main, ...deck.side].map((e) => e.name);
    fetchCards(names)
      .then(({ cards, missing }) => {
        if (!cancelled) setState({ cards, missing, loading: false, error: null });
      })
      .catch((error: unknown) => {
        console.error('Errore nel caricamento delle carte', error);
        if (!cancelled) {
          setState({ cards: new Map(), missing: [], loading: false, error: 'Scryfall non raggiungibile' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deck]);

  const getCard = useCallback(
    (name: string): DisplayCard => lookupCard(state.cards, name),
    [state.cards],
  );

  return { ...state, getCard };
};
