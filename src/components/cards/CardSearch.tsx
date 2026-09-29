import { useEffect, useRef, useState } from 'react';
import { autocompleteCardNames } from '../../services/scryfall';

interface CardSearchProps {
  onSelect: (name: string) => void;
  placeholder?: string;
}

/**
 * Campo di ricerca con suggerimenti Scryfall, navigabile da tastiera
 */
export default function CardSearch({ onSelect, placeholder = 'Cerca una carta…' }: CardSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const names = await autocompleteCardNames(query, controller.signal);
        setResults(names);
        setActive(0);
        setOpen(true);
      } catch {
        // richiesta annullata o rete assente
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const choose = (name: string) => {
    onSelect(name);
    setQuery('');
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="relative">
        <svg className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-stone-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 3.36 9.86l3.64 3.64a.75.75 0 1 0 1.06-1.06l-3.64-3.64A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clipRule="evenodd" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && results[active]) {
              e.preventDefault();
              choose(results[active]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          className="h-12 w-full rounded-xl border border-white/10 bg-black/30 pr-10 pl-11 text-stone-100 placeholder:text-stone-600 focus:border-gold-400/60 focus:outline-none"
        />
        {searching && (
          <span className="absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-stone-500 border-t-transparent" />
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-white/10 bg-felt-900 p-1 shadow-2xl"
        >
          {results.map((name, i) => (
            <li
              key={name}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(name);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${i === active ? 'bg-gold-400/15 text-gold-100' : 'text-stone-300'}`}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
