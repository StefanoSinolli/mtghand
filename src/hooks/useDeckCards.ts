import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchCards, lookupCard } from '../services/scryfall';
import type { Deck, DisplayCard, ScryfallCard } from '../types';

interface CardsState {
  cards: Map<string, ScryfallCard>;
  missing: string[];
  loading: boolean;
  error: string | null;
}

/**
 * Carica da Scryfall i dati di una lista di carte.
 * Mentre carica nuovi nomi mantiene quelli già noti (niente sfarfallio nell'editor).
 */
export const useCards = (names: string[] | null) => {
  const [state, setState] = useState<CardsState>({
    cards: new Map(),
    missing: [],
    loading: names !== null && names.length > 0,
    error: null,
  });

  const key = names ? [...new Set(names)].sort().join('\n') : null;

  useEffect(() => {
    if (key === null) return;
    const list = key ? key.split('\n') : [];
    if (list.length === 0) {
      setState((prev) => ({ ...prev, missing: [], loading: false }));
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    fetchCards(list)
      .then(({ cards, missing }) => {
        if (cancelled) return;
        setState((prev) => ({ cards: new Map([...prev.cards, ...cards]), missing, loading: false, error: null }));
      })
      .catch((error: unknown) => {
        console.error('Errore nel caricamento delle carte', error);
        if (!cancelled) setState((prev) => ({ ...prev, loading: false, error: 'Scryfall non raggiungibile' }));
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  const getCard = useCallback((name: string): DisplayCard => lookupCard(state.cards, name), [state.cards]);

  return { ...state, getCard };
};

/**
 * Carica i dati di tutte le carte del mazzo (main + sideboard)
 */
export const useDeckCards = (deck: Deck | null) => {
  const names = useMemo(() => (deck ? [...deck.main, ...deck.side].map((e) => e.name) : null), [deck]);
  return useCards(names);
};
