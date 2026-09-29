import './ManaCost.css';

const SYMBOL_URL = 'https://svgs.scryfall.io/card-symbols';

interface ManaSymbolProps {
  /** Simbolo senza graffe, es. "U", "2", "G/W", "R/P" */
  symbol: string;
}

export function ManaSymbol({ symbol }: ManaSymbolProps) {
  const file = symbol.replace(/\//g, '').toUpperCase();
  return <img className="mana-symbol" src={`${SYMBOL_URL}/${file}.svg`} alt={`{${symbol}}`} title={`{${symbol}}`} />;
}

interface ManaCostProps {
  /** Costo in formato Scryfall, es. "{1}{U}{R}" */
  cost: string;
}

export default function ManaCost({ cost }: ManaCostProps) {
  const symbols = [...cost.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  if (symbols.length === 0) return null;

  return (
    <span className="mana-cost-symbols" aria-label={cost}>
      {symbols.map((s, i) => (
        <ManaSymbol key={i} symbol={s} />
      ))}
    </span>
  );
}

/** Simboli per una chiave di colori dell'analisi: "U" → {U}, "WG" → {W}{G} */
export function ColorKey({ colorKey }: { colorKey: string }) {
  return (
    <span className="mana-cost-symbols">
      {colorKey.split('').map((c) => (
        <ManaSymbol key={c} symbol={c} />
      ))}
    </span>
  );
}
