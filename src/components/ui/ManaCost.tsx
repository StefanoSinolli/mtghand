const SYMBOL_URL = 'https://svgs.scryfall.io/card-symbols';

interface ManaSymbolProps {
  /** Simbolo senza graffe, es. "U", "2", "G/W", "R/P" */
  symbol: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: 'h-3.5 w-3.5', md: 'h-[1.1em] w-[1.1em]', lg: 'h-6 w-6' };

export function ManaSymbol({ symbol, size = 'md' }: ManaSymbolProps) {
  const file = symbol.replace(/\//g, '').toUpperCase();
  return (
    <img
      className={`${SIZES[size]} inline-block shrink-0 rounded-full shadow-[-1px_1px_0_rgb(0_0_0/0.6)]`}
      src={`${SYMBOL_URL}/${file}.svg`}
      alt={`{${symbol}}`}
      title={`{${symbol}}`}
      loading="lazy"
    />
  );
}

interface ManaCostProps {
  /** Costo in formato Scryfall, es. "{1}{U}{R}" */
  cost: string;
  size?: ManaSymbolProps['size'];
}

export default function ManaCost({ cost, size }: ManaCostProps) {
  const symbols = [...cost.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  if (symbols.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-0.5 align-middle" aria-label={cost}>
      {symbols.map((s, i) => (
        <ManaSymbol key={i} symbol={s} size={size} />
      ))}
    </span>
  );
}

/** Simboli per una chiave di colori: "U" → {U}, "WG" → {W}{G} */
export function ColorKey({ colorKey, size }: { colorKey: string; size?: ManaSymbolProps['size'] }) {
  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      {colorKey.split('').map((c) => (
        <ManaSymbol key={c} symbol={c} size={size} />
      ))}
    </span>
  );
}

/** Testo con simboli di mana inline, es. "Blu: {U}{U} al turno 2" */
export function ManaText({ text }: { text: string }) {
  const parts = text.split(/((?:\{[^}]+\})+)/g);
  return (
    <>
      {parts.map((part, i) => (part.startsWith('{') ? <ManaCost key={i} cost={part} size="sm" /> : part))}
    </>
  );
}
