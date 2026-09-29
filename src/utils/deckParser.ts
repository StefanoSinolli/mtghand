/**
 * Parser per decklist MTG in formato testo
 * Supporta i formati comuni:
 * - "4 Lightning Bolt" / "4x Lightning Bolt" / "Lightning Bolt x4"
 * - Arena: "4 Lightning Bolt (M10) 146"
 * - Header "Deck", "Sideboard", "Companion", "Commander", ecc.
 * - MTGO: main e sideboard separati da una riga vuota
 */

import type { DeckEntry } from '../types';

export interface ParsedDeck {
  main: DeckEntry[];
  side: DeckEntry[];
  /** Righe che non sono state riconosciute */
  unrecognized: string[];
}

type Section = 'main' | 'side' | 'skip';

// Header di sezione → sezione di destinazione
const SECTION_HEADERS: Record<string, Section> = {
  deck: 'main',
  main: 'main',
  maindeck: 'main',
  'main deck': 'main',
  mainboard: 'main',
  sideboard: 'side',
  side: 'side',
  sb: 'side',
  companion: 'side',
  commander: 'skip',
  maybeboard: 'skip',
  considering: 'skip',
  about: 'skip',
};

// "4 Name", "4x Name", con suffisso Arena opzionale "(SET) 123"
const QTY_FIRST = /^(\d+)\s*x?\s+(.+?)(?:\s+\(([A-Za-z0-9]{2,6})\)(?:\s+(\S+))?)?$/i;
// "Name x4"
const QTY_LAST = /^(.+?)\s+x(\d+)$/i;
// Prefisso sideboard stile MTGO/Moxfield "SB: 2 Name"
const SB_PREFIX = /^SB:\s*/i;

const normalizeHeader = (line: string) => line.toLowerCase().replace(/[:\s]+$/, '').trim();

const addEntry = (list: DeckEntry[], entry: DeckEntry) => {
  const existing = list.find((e) => e.name.toLowerCase() === entry.name.toLowerCase());
  if (existing) {
    existing.quantity += entry.quantity;
  } else {
    list.push({ ...entry });
  }
};

const parseCardLine = (line: string): DeckEntry | null => {
  const first = line.match(QTY_FIRST);
  if (first) {
    const entry: DeckEntry = { name: first[2].trim(), quantity: parseInt(first[1], 10) };
    if (first[3]) entry.set = first[3].toLowerCase();
    if (first[4]) entry.collectorNumber = first[4];
    return entry;
  }

  const last = line.match(QTY_LAST);
  if (last) {
    return { name: last[1].trim(), quantity: parseInt(last[2], 10) };
  }

  // Nessuna quantità: una copia
  if (/^[^\d]/.test(line)) {
    return { name: line, quantity: 1 };
  }

  return null;
};

export const parseDeckList = (text: string): ParsedDeck => {
  const main: DeckEntry[] = [];
  const side: DeckEntry[] = [];
  const unrecognized: string[] = [];

  let section: Section = 'main';
  let explicitSections = false;
  let sawBlankAfterCards = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line) {
      // MTGO: la prima riga vuota dopo il main separa la sideboard
      if (main.length > 0 && section === 'main') sawBlankAfterCards = true;
      continue;
    }

    if (line.startsWith('//') || line.startsWith('#')) continue;

    // "Name Deck Name" (Arena) → ignora
    if (/^name\s/i.test(line)) continue;

    const header = SECTION_HEADERS[normalizeHeader(line)];
    if (header) {
      section = header;
      explicitSections = true;
      sawBlankAfterCards = false;
      continue;
    }

    // Header sconosciuto tipo "Lands:" o "Creatures (20)" → ignora
    if (/^\D.*:$/.test(line) || /^[A-Za-z ]+\(\d+\)$/.test(line)) continue;

    let cardLine = line;
    let forceSide = false;
    if (SB_PREFIX.test(cardLine)) {
      cardLine = cardLine.replace(SB_PREFIX, '');
      forceSide = true;
    }

    const entry = parseCardLine(cardLine);
    if (!entry || entry.quantity <= 0) {
      unrecognized.push(line);
      continue;
    }

    if (section === 'skip') continue;

    const goesToSide =
      forceSide || section === 'side' || (!explicitSections && sawBlankAfterCards);

    addEntry(goesToSide ? side : main, entry);
  }

  return { main, side, unrecognized };
};

export const countCards = (entries: DeckEntry[]) =>
  entries.reduce((sum, e) => sum + e.quantity, 0);

/** Espande le entry in una lista di nomi, una per copia */
export const expandEntries = (entries: DeckEntry[]): string[] =>
  entries.flatMap((e) => Array.from({ length: e.quantity }, () => e.name));

/** Serializza il mazzo nel formato testo standard */
export const formatDeckList = (main: DeckEntry[], side: DeckEntry[] = []) => {
  const lines = main.map((e) => `${e.quantity} ${e.name}`);
  if (side.length > 0) {
    lines.push('', 'Sideboard', ...side.map((e) => `${e.quantity} ${e.name}`));
  }
  return lines.join('\n');
};
