import { useOutletContext } from 'react-router';
import type { Deck, DisplayCard, ScryfallCard } from '../types';

export interface DeckContext {
  deck: Deck;
  cards: Map<string, ScryfallCard>;
  loading: boolean;
  missing: string[];
  error: string | null;
  getCard: (name: string) => DisplayCard;
}

/** Dati del mazzo corrente, forniti da DeckLayout alle sottopagine */
export const useDeckContext = () => useOutletContext<DeckContext>();
