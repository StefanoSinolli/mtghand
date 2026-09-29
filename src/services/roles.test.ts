import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildRoleQuery, chunkNames, fetchRoles, ROLES } from './roles';

afterEach(() => vi.unstubAllGlobals());

/** Risponde alle ricerche Scryfall come se le etichette fossero quelle indicate */
const mockScryfall = (tags: Record<string, string[]>) => {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const q = decodeURIComponent(new URL(url).searchParams.get('q') ?? '');
      calls.push(q);
      const tag = q.match(/^otag:(\S+)/)![1];
      const asked = [...q.matchAll(/!"([^"]+)"/g)].map((m) => m[1]);
      // come Scryfall: !"Nome" trova anche le carte doppie con una faccia che si chiama così
      const data = (tags[tag] ?? [])
        .filter((name) => name.split(' // ').some((face) => asked.includes(face)))
        .map((name) => ({ name }));
      if (data.length === 0) return new Response(JSON.stringify({ object: 'error' }), { status: 404 });
      return new Response(JSON.stringify({ data, has_more: false }), { status: 200 });
    }),
  );
  return calls;
};

describe('ruoli delle carte', () => {
  it('costruisce la query per etichetta e nomi esatti', () => {
    expect(buildRoleQuery('tutor', ['Demonic Tutor', 'Fire // Ice'])).toBe('otag:tutor (!"Demonic Tutor" or !"Fire")');
  });

  it('divide i nomi in query di lunghezza limitata', () => {
    const names = Array.from({ length: 100 }, (_, i) => `Carta con un nome abbastanza lungo ${i}`);
    const chunks = chunkNames(names);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flat()).toEqual(names);
    for (const chunk of chunks) expect(buildRoleQuery('sacrifice-outlet', chunk).length).toBeLessThanOrEqual(950);
  });

  it('non ripete le ricerche uguali in contemporanea', async () => {
    const calls = mockScryfall({ tutor: ['Vampiric Tutor'] });
    const [a, b] = await Promise.all([fetchRoles(['Vampiric Tutor']), fetchRoles(['Vampiric Tutor'])]);
    expect(a).toBe(b);
    expect(calls).toHaveLength(ROLES.length);
  });

  it('assegna i ruoli, gestisce "nessun risultato" e usa la cache', async () => {
    const calls = mockScryfall({
      'sacrifice-outlet': ['Viscera Seer', "Ashnod's Altar"],
      'life-drain': ['Blood Artist', 'Zulaport Cutthroat'],
      tutor: ['Demonic Tutor', 'Emeritus of Woe // Demonic Tutor'],
      removal: ['Emeritus of Conflict // Lightning Bolt'],
      ramp: ["Ashnod's Altar"],
    });
    const names = ['Viscera Seer', 'Blood Artist', 'Zulaport Cutthroat', "Ashnod's Altar", 'Demonic Tutor', 'Lightning Bolt'];
    const roles = await fetchRoles(names);

    expect(calls).toHaveLength(ROLES.length);
    expect(roles.get('viscera seer')).toEqual(['sacOutlet']);
    expect(roles.get("ashnod's altar")).toEqual(['ramp', 'sacOutlet']);
    expect(roles.get('blood artist')).toEqual(['drain']);
    expect(roles.get('demonic tutor')).toEqual(['tutor']);
    // una carta diversa con un retro che si chiama Lightning Bolt non le dà il suo ruolo
    expect(roles.get('lightning bolt')).toEqual([]);

    // seconda volta: tutto dalla cache, nessuna richiesta
    const again = await fetchRoles(names);
    expect(calls).toHaveLength(ROLES.length);
    expect(again.get('viscera seer')).toEqual(['sacOutlet']);
  });
});
