/**
 * Modello dati condiviso dell'applicazione
 */

export type DeckFormat = 'constructed60';

export interface DeckEntry {
  name: string;
  quantity: number;
  set?: string;
  collectorNumber?: string;
}

export interface Deck {
  id: string;
  name: string;
  format: DeckFormat;
  main: DeckEntry[];
  side: DeckEntry[];
  schemaVersion: 2;
  createdAt: string;
  updatedAt: string;
  isTestDeck?: boolean;
}

/** Singola copia fisica di una carta durante la simulazione (uid = key React stabile) */
export interface CardInstance {
  uid: string;
  name: string;
}

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G';

export interface ScryfallImageUris {
  small?: string;
  normal?: string;
  large?: string;
  png?: string;
  art_crop?: string;
  border_crop?: string;
}

export interface ScryfallCardFace {
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  colors?: ManaColor[];
  power?: string;
  toughness?: string;
  image_uris?: ScryfallImageUris;
}

/** Sottoinsieme dei campi Scryfall che usiamo */
export interface ScryfallCard {
  id: string;
  name: string;
  layout: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  colors?: ManaColor[];
  color_identity: ManaColor[];
  produced_mana?: string[];
  power?: string;
  toughness?: string;
  rarity?: string;
  set?: string;
  set_name?: string;
  legalities?: Record<string, string>;
  image_uris?: ScryfallImageUris;
  card_faces?: ScryfallCardFace[];
}

/** Carta non trovata su Scryfall: mostriamo comunque il nome */
export interface PlaceholderCard {
  name: string;
  placeholder: true;
}

export type DisplayCard = ScryfallCard | PlaceholderCard;

export const isPlaceholder = (card: DisplayCard): card is PlaceholderCard =>
  'placeholder' in card && card.placeholder === true;
