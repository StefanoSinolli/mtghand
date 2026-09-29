/**
 * Parser per decklist MTG in formato testo
 * Supporta i formati comuni:
 * - "4 Lightning Bolt" / "4x Lightning Bolt" / "Lightning Bolt x4"
 * - Arena: "4 Lightning Bolt (M10) 146"
 * - Header "Deck", "Sideboard", "Companion", "Commander", ecc.
 * - MTGO: main e sideboard separati da una riga vuota
 * - Comandante: sezione "Commander", marcatore Moxfield "*CMDR*", categoria Archidekt "[Commander]"
 */

import type { DeckEntry } from '../types';

export interface ParsedDeck {
  main: DeckEntry[];
  side: DeckEntry[];
  /** Carte indicate esplicitamente come comandante */
  commanders: DeckEntry[];
  /** Righe che non sono state riconosciute */
  unrecognized: string[];
}

type Section = 'main' | 'side' | 'commander' | 'skip';

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
  commander: 'commander',
  commanders: 'commander',
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
// Marcatori a fine riga: Moxfield "*CMDR*", "*F*" (foil), Archidekt "[Commander{top}]" e "^Tag,#colore^"
const CMDR_MARK = /\*CMDR\*/i;
const TRAILING_TAGS = /\s*(?:\*[A-Z]+\*|\[[^\]]*\]|\^[^^]*\^)\s*/gi;

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
  const commanders: DeckEntry[] = [];
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

    const bracket = cardLine.match(/\[([^\]]*)\]/);
    const forceCommander = CMDR_MARK.test(cardLine) || (bracket !== null && /commander/i.test(bracket[1]));
    cardLine = cardLine.replace(TRAILING_TAGS, ' ').trim();

    const entry = parseCardLine(cardLine);
    if (!entry || entry.quantity <= 0) {
      unrecognized.push(line);
      continue;
    }

    if (section === 'skip') continue;

    if (forceCommander || section === 'commander') {
      addEntry(commanders, entry);
      continue;
    }

    const goesToSide =
      forceSide || section === 'side' || (!explicitSections && sawBlankAfterCards);

    addEntry(goesToSide ? side : main, entry);
  }

  return { main, side, commanders, unrecognized };
};

const BASIC_NAMES = /^(Snow-Covered )?(Plains|Island|Swamp|Mountain|Forest|Wastes)$/i;

/** Tutte le carte non base in una sola copia */
const isSingleton = (entries: DeckEntry[]) => entries.every((e) => e.quantity === 1 || BASIC_NAMES.test(e.name));

export interface FormatSuggestion {
  format: 'constructed60' | 'commander';
  main: DeckEntry[];
  side: DeckEntry[];
  commanders: DeckEntry[];
}

/**
 * Riconosce una lista Commander e separa il comandante:
 * - comandante indicato esplicitamente (sezione, *CMDR*, [Commander])
 * - convenzione MTGO: 99 carte + 1–2 carte dopo la riga vuota
 * - 100 carte singleton senza comandante indicato (lo sceglie l'utente)
 */
export const suggestFormat = (parsed: ParsedDeck): FormatSuggestion => {
  const { main, side, commanders } = parsed;
  const mainCount = countCards(main);

  if (commanders.length > 0) {
    return { format: 'commander', main, side: [], commanders };
  }

  const sideCount = countCards(side);
  if (sideCount >= 1 && sideCount <= 2 && mainCount + sideCount === 100 && isSingleton(main) && isSingleton(side)) {
    return { format: 'commander', main, side: [], commanders: side };
  }

  if ((mainCount === 100 || mainCount === 99) && side.length === 0 && isSingleton(main)) {
    return { format: 'commander', main, side: [], commanders: [] };
  }

  return { format: 'constructed60', main, side, commanders: [] };
};

export const countCards = (entries: DeckEntry[]) =>
  entries.reduce((sum, e) => sum + e.quantity, 0);

/** Espande le entry in una lista di nomi, una per copia */
export const expandEntries = (entries: DeckEntry[]): string[] =>
  entries.flatMap((e) => Array.from({ length: e.quantity }, () => e.name));

/** Serializza il mazzo nel formato testo standard (con sezione Commander se presente) */
export const formatDeckList = (main: DeckEntry[], side: DeckEntry[] = [], commanders: DeckEntry[] = []) => {
  const toLines = (entries: DeckEntry[]) => entries.map((e) => `${e.quantity} ${e.name}`);
  const lines: string[] = [];
  if (commanders.length > 0) lines.push('Commander', ...toLines(commanders), '', 'Deck');
  lines.push(...toLines(main));
  if (side.length > 0) lines.push('', 'Sideboard', ...toLines(side));
  return lines.join('\n');
};

/**
 * Liste finali per l'import nel formato scelto.
 * Nel Commander, se la lista non indica il comandante, `pickedCommander` lo sposta dal mazzo.
 */
export const buildImport = (parsed: ParsedDeck, format: 'constructed60' | 'commander', pickedCommander?: string) => {
  if (format === 'constructed60') {
    const main = parsed.commanders.reduce((list, c) => {
      const copy = list.map((e) => ({ ...e }));
      addEntry(copy, c);
      return copy;
    }, parsed.main);
    return { main, side: parsed.side, commanders: [] as DeckEntry[] };
  }

  const suggestion = suggestFormat(parsed);
  const base = suggestion.format === 'commander' ? suggestion : { main: parsed.main, commanders: parsed.commanders };
  let main = base.main;
  let commanders = base.commanders;

  if (commanders.length === 0 && pickedCommander) {
    const entry = main.find((e) => e.name === pickedCommander);
    if (entry) {
      main = main
        .map((e) => (e === entry ? { ...e, quantity: e.quantity - 1 } : e))
        .filter((e) => e.quantity > 0);
      commanders = [{ name: entry.name, quantity: 1 }];
    }
  }

  return { main, side: [] as DeckEntry[], commanders };
};

/** Carte candidate a comandante nella scelta manuale: una copia, non terre base */
export const commanderCandidates = (entries: DeckEntry[]) =>
  entries
    .filter((e) => e.quantity === 1 && !BASIC_NAMES.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
