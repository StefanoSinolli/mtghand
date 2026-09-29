import cardsJson from './cards.json';
import { normalizeName } from '../../services/scryfall';
import { parseDeckList } from '../../utils/deckParser';
import type { Deck, ScryfallCard } from '../../types';

const all = cardsJson as unknown as ScryfallCard[];

export const fixtureCards = new Map<string, ScryfallCard>();
for (const card of all) {
  fixtureCards.set(normalizeName(card.name), card);
  for (const face of card.card_faces ?? []) fixtureCards.set(normalizeName(face.name), card);
}

export const fixtureCard = (name: string) => {
  const card = fixtureCards.get(normalizeName(name));
  if (!card) throw new Error(`Fixture mancante: ${name}`);
  return card;
};

export const deckFrom = (text: string): Deck => {
  const { main, side } = parseDeckList(text);
  return {
    id: 'test',
    name: 'Test',
    format: 'constructed60',
    main,
    side,
    schemaVersion: 2,
    createdAt: '',
    updatedAt: '',
  };
};
