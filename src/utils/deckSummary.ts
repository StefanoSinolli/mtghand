/**
 * Riepilogo di un mazzo per la UI: copertina, colori, curva, raggruppamento per tipo
 */

import { lookupCard } from '../services/scryfall';
import { isPlaceholder, type Deck, type DeckEntry, type DisplayCard, type ManaColor, type ScryfallCard } from '../types';

export const CARD_TYPES = [
  'Creature',
  'Planeswalker',
  'Battle',
  'Instant',
  'Sorcery',
  'Artifact',
  'Enchantment',
  'Land',
] as const;

export type CardType = (typeof CARD_TYPES)[number] | 'Other';

export const TYPE_LABELS: Record<CardType, string> = {
  Creature: 'Creature',
  Planeswalker: 'Planeswalker',
  Battle: 'Battaglie',
  Instant: 'Istantanei',
  Sorcery: 'Stregonerie',
  Artifact: 'Artefatti',
  Enchantment: 'Incantesimi',
  Land: 'Terre',
  Other: 'Altro',
};

const WUBRG: ManaColor[] = ['W', 'U', 'B', 'R', 'G'];

const frontType = (card: ScryfallCard) => card.card_faces?.[0]?.type_line ?? card.type_line;

/** Tipo principale della carta, nell'ordine di CARD_TYPES (una creatura artefatto è una creatura) */
export const primaryType = (card: DisplayCard): CardType => {
  if (isPlaceholder(card)) return 'Other';
  const type = frontType(card);
  return CARD_TYPES.find((t) => new RegExp(`\\b${t}\\b`).test(type)) ?? 'Other';
};

export const isBasicLand = (card: DisplayCard) => !isPlaceholder(card) && /\bBasic\b/.test(card.type_line);

export interface GroupedEntries {
  type: CardType;
  entries: Array<DeckEntry & { card: DisplayCard }>;
  count: number;
}

export const groupByType = (entries: DeckEntry[], cards: Map<string, ScryfallCard>): GroupedEntries[] => {
  const groups = new Map<CardType, GroupedEntries>();

  for (const entry of entries) {
    const card = lookupCard(cards, entry.name);
    const type = primaryType(card);
    const group = groups.get(type) ?? { type, entries: [], count: 0 };
    group.entries.push({ ...entry, card });
    group.count += entry.quantity;
    groups.set(type, group);
  }

  const order = [...CARD_TYPES, 'Other'] as CardType[];
  return [...groups.values()]
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
    .map((g) => ({
      ...g,
      entries: g.entries.sort((a, b) => {
        const cmcA = isPlaceholder(a.card) ? 99 : a.card.cmc;
        const cmcB = isPlaceholder(b.card) ? 99 : b.card.cmc;
        return cmcA - cmcB || a.name.localeCompare(b.name);
      }),
    }));
};

export interface DeckSummary {
  cover: ScryfallCard | null;
  colors: ManaColor[];
  /** Carte del mazzo, comandante incluso */
  mainCount: number;
  /** Comandanti trovati su Scryfall (solo Commander) */
  commanders: ScryfallCard[];
  sideCount: number;
  lands: number;
  /** Magie per valore di mana: indice 0..6, l'ultimo è 7+ */
  curve: number[];
  averageManaValue: number;
}

export const summarizeDeck = (deck: Deck, cards: Map<string, ScryfallCard>): DeckSummary => {
  const colorSet = new Set<ManaColor>();
  const curve = new Array<number>(8).fill(0);
  let lands = 0;
  let mvSum = 0;
  let spells = 0;
  let cover: { card: ScryfallCard; score: number } | null = null;

  for (const entry of deck.main) {
    const card = lookupCard(cards, entry.name);
    if (isPlaceholder(card)) continue;

    if (primaryType(card) === 'Land') {
      lands += entry.quantity;
      continue;
    }

    for (const c of card.color_identity) colorSet.add(c);
    const mv = Math.round(card.cmc);
    curve[Math.min(7, mv)] += entry.quantity;
    mvSum += card.cmc * entry.quantity;
    spells += entry.quantity;

    // Copertina: la magia con più copie, a parità la più costosa
    const score = entry.quantity * 100 + card.cmc;
    if (!cover || score > cover.score) cover = { card, score };
  }

  // Commander: copertina e colori vengono dal comandante
  const commanders = (deck.format === 'commander' ? (deck.commanders ?? []) : [])
    .map((e) => lookupCard(cards, e.name))
    .filter((c): c is ScryfallCard => !isPlaceholder(c));
  const identity = new Set(commanders.flatMap((c) => c.color_identity));

  return {
    cover: commanders[0] ?? cover?.card ?? null,
    colors: WUBRG.filter((c) => (commanders.length > 0 ? identity : colorSet).has(c)),
    mainCount:
      deck.main.reduce((s, e) => s + e.quantity, 0) + (deck.commanders ?? []).reduce((s, e) => s + e.quantity, 0),
    commanders,
    sideCount: deck.side.reduce((s, e) => s + e.quantity, 0),
    lands,
    curve,
    averageManaValue: spells > 0 ? mvSum / spells : 0,
  };
};
