/**
 * Mazzo ⇄ stringa per i link di condivisione: JSON compatto → deflate → base64url.
 * Tutto il mazzo sta nel link: nessun server.
 */

import type { Deck, DeckEntry, DeckFormat } from '../types';

const VERSION = 1;

/** Formato compatto: [quantità, nome] */
type Packed = [number, string];

interface SharedPayload {
  v: number;
  n: string;
  f: DeckFormat;
  m: Packed[];
  s?: Packed[];
  c?: Packed[];
}

export interface SharedDeck {
  name: string;
  format: DeckFormat;
  main: DeckEntry[];
  side: DeckEntry[];
  commanders: DeckEntry[];
}

const pack = (entries: DeckEntry[]): Packed[] => entries.map((e) => [e.quantity, e.name]);

const unpack = (packed: unknown): DeckEntry[] => {
  if (!Array.isArray(packed)) return [];
  return packed
    .filter((p): p is Packed => Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'string')
    .filter(([quantity, name]) => quantity > 0 && quantity < 1000 && name.length > 0 && name.length < 200)
    .map(([quantity, name]) => ({ name, quantity }));
};

const toBase64Url = (bytes: Uint8Array) => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string) => {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

const transform = async (bytes: Uint8Array, stream: CompressionStream | DecompressionStream) =>
  new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream)).arrayBuffer());

export const encodeDeck = async (deck: Pick<Deck, 'name' | 'format' | 'main' | 'side' | 'commanders'>) => {
  const payload: SharedPayload = { v: VERSION, n: deck.name, f: deck.format, m: pack(deck.main) };
  if (deck.side.length > 0 && deck.format !== 'commander') payload.s = pack(deck.side);
  if (deck.format === 'commander' && deck.commanders?.length) payload.c = pack(deck.commanders);

  const json = new TextEncoder().encode(JSON.stringify(payload));
  return toBase64Url(await transform(json, new CompressionStream('deflate-raw')));
};

/** Decodifica un link; restituisce null se non è valido */
export const decodeDeck = async (text: string): Promise<SharedDeck | null> => {
  try {
    const json = await transform(fromBase64Url(text), new DecompressionStream('deflate-raw'));
    const data = JSON.parse(new TextDecoder().decode(json)) as Partial<SharedPayload>;
    if (data.v !== VERSION) return null;

    const format: DeckFormat = data.f === 'commander' ? 'commander' : 'constructed60';
    const main = unpack(data.m);
    if (main.length === 0) return null;

    return {
      name: typeof data.n === 'string' && data.n.trim() ? data.n.slice(0, 100) : 'Mazzo condiviso',
      format,
      main,
      side: unpack(data.s),
      commanders: format === 'commander' ? unpack(data.c) : [],
    };
  } catch {
    return null;
  }
};

/** Link completo alla pagina del mazzo condiviso (funziona in locale e online) */
export const shareUrl = (payload: string) =>
  `${window.location.origin}${window.location.pathname}#/s/${payload}`;
