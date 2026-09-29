import { useMemo, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router';
import { createDeck } from '../services/deckStorage';
import { saveDeck } from '../store/decks';
import { buildImport, commanderCandidates, countCards, parseDeckList, suggestFormat } from '../utils/deckParser';
import type { DeckFormat } from '../types';
import Button from '../components/ui/Button';
import Panel from '../components/ui/Panel';

const PLACEHOLDER = `Deck
4 Lightning Bolt
4 Monastery Swiftspear
20 Mountain

Sideboard
3 Smash to Smithereens`;

export default function ImportPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);

  const [formatChoice, setFormatChoice] = useState<DeckFormat | null>(null);
  const [picked, setPicked] = useState('');

  const parsed = useMemo(() => parseDeckList(text), [text]);
  const suggestion = useMemo(() => suggestFormat(parsed), [parsed]);
  // la spunta segue il suggerimento finché l'utente non la cambia
  const format = formatChoice ?? suggestion.format;
  const isCommander = format === 'commander';
  const result = useMemo(() => buildImport(parsed, format, picked || undefined), [parsed, format, picked]);
  const needsPick = isCommander && suggestion.commanders.length === 0 && parsed.commanders.length === 0;
  const mainCount = countCards(result.main);
  const sideCount = countCards(result.side);
  const commanderCount = countCards(result.commanders);

  const loadFile = async (file: File) => {
    setText(await file.text());
    if (!name.trim()) setName(file.name.replace(/\.(txt|dek|dec)$/i, ''));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  };

  const handleImport = () => {
    const deck = createDeck(name.trim() || 'Nuovo mazzo', result.main, result.side, format, result.commanders);
    saveDeck(deck);
    navigate(`/deck/${deck.id}`);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-wide text-gold-gradient">Importa un mazzo</h1>
        <p className="mt-1 text-stone-400">
          Incolla la lista esportata da Arena, MTGO, Moxfield o un file di testo.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Panel>
          <label className="block">
            <span className="text-sm font-semibold text-stone-300">Nome del mazzo</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Es. Mono Red Aggro"
              className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-stone-100 placeholder:text-stone-600 focus:border-gold-400/60 focus:outline-none"
            />
          </label>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`relative mt-4 rounded-xl border transition-colors ${
              dragging ? 'border-gold-400 bg-gold-400/5' : 'border-white/10'
            }`}
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDER}
              rows={16}
              spellCheck={false}
              className="block w-full resize-y rounded-xl bg-black/30 p-4 font-mono text-sm leading-relaxed text-stone-100 placeholder:text-stone-600 focus:outline-none"
            />
            {dragging && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-felt-950/80 font-semibold text-gold-300">
                Rilascia il file qui
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-stone-400">
            <label className="cursor-pointer text-gold-300 hover:text-gold-200">
              <input
                type="file"
                accept=".txt,.dek,.dec"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
              />
              Carica da file…
            </label>
            <span>oppure trascina un file .txt nell'area di testo</span>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Anteprima">
            <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-xl bg-black/20 px-3 py-2.5">
              <input
                type="checkbox"
                checked={isCommander}
                onChange={(e) => setFormatChoice(e.target.checked ? 'commander' : 'constructed60')}
                className="h-4 w-4 accent-gold-400"
              />
              <span className="text-sm font-semibold text-stone-200">Mazzo Commander</span>
              {formatChoice === null && suggestion.format === 'commander' && (
                <span className="ml-auto text-xs text-gold-300">riconosciuto</span>
              )}
            </label>

            {isCommander && (
              <div className="mb-4 rounded-xl bg-black/20 p-3 text-sm">
                <p className="text-xs text-stone-500">Comandante</p>
                {needsPick ? (
                  <select
                    value={picked}
                    onChange={(e) => setPicked(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-felt-900 px-2 py-1.5 text-stone-100"
                  >
                    <option value="">Scegli il comandante…</option>
                    {commanderCandidates(parsed.main).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-0.5 font-semibold text-gold-200">
                    {result.commanders.map((c) => c.name).join(' + ') || '—'}
                  </p>
                )}
              </div>
            )}

            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-black/20 p-3">
                <dt className="text-xs text-stone-500">{isCommander ? 'Totale' : 'Main'}</dt>
                <dd
                  className={`text-2xl font-bold ${
                    (isCommander ? mainCount + commanderCount === 100 : mainCount >= 60) ? 'text-emerald-300' : 'text-stone-100'
                  }`}
                >
                  {isCommander ? mainCount + commanderCount : mainCount}
                </dd>
              </div>
              {isCommander ? (
                <div className="rounded-xl bg-black/20 p-3">
                  <dt className="text-xs text-stone-500">Nel grimorio</dt>
                  <dd className="text-2xl font-bold text-stone-100">{mainCount}</dd>
                </div>
              ) : (
                <div className="rounded-xl bg-black/20 p-3">
                  <dt className="text-xs text-stone-500">Sideboard</dt>
                  <dd className={`text-2xl font-bold ${sideCount > 15 ? 'text-red-300' : 'text-stone-100'}`}>{sideCount}</dd>
                </div>
              )}
            </dl>
            <p className="mt-3 text-sm text-stone-400">
              {parsed.main.length + parsed.side.length + parsed.commanders.length} carte diverse riconosciute.
            </p>
            {!isCommander && mainCount > 0 && mainCount < 60 && (
              <p className="mt-2 text-sm text-gold-300">Nel Constructed il main deck deve avere almeno 60 carte.</p>
            )}
            {isCommander && mainCount > 0 && mainCount + commanderCount !== 100 && (
              <p className="mt-2 text-sm text-gold-300">Nel Commander le carte devono essere esattamente 100, comandante incluso.</p>
            )}
            {parsed.unrecognized.length > 0 && (
              <div className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm">
                <p className="font-semibold text-red-200">Righe ignorate:</p>
                <ul className="mt-1 space-y-0.5 font-mono text-xs text-red-200/80">
                  {parsed.unrecognized.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button variant="primary" size="lg" className="mt-5 w-full" disabled={mainCount === 0} onClick={handleImport}>
              Importa mazzo
            </Button>
          </Panel>

          <Panel title="Formati supportati">
            <ul className="space-y-1.5 text-sm text-stone-400">
              <li>
                <code className="text-stone-200">4 Lightning Bolt</code> o <code className="text-stone-200">4x …</code>
              </li>
              <li>
                Arena: <code className="text-stone-200">4 Lightning Bolt (M10) 146</code>
              </li>
              <li>
                Sideboard dopo <code className="text-stone-200">Sideboard</code>, una riga vuota o{' '}
                <code className="text-stone-200">SB:</code>
              </li>
              <li>
                Comandante: sezione <code className="text-stone-200">Commander</code>,{' '}
                <code className="text-stone-200">*CMDR*</code> (Moxfield) o{' '}
                <code className="text-stone-200">[Commander]</code> (Archidekt)
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
