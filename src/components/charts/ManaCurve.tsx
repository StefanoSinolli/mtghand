interface ManaCurveProps {
  /** Magie per valore di mana, indice 0..7 (7 = 7+) */
  curve: number[];
}

export default function ManaCurve({ curve }: ManaCurveProps) {
  const max = Math.max(1, ...curve);
  return (
    <div className="flex h-36 items-end gap-2">
      {curve.map((count, mv) => (
        <div key={mv} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span className="text-xs font-semibold text-stone-300">{count || ''}</span>
          <div
            className="w-full rounded-t-md bg-gradient-to-t from-gold-600 to-gold-300 transition-[height] duration-500"
            style={{ height: `${(count / max) * 100}%`, minHeight: count ? 4 : 0 }}
          />
          <span className="text-xs font-bold text-stone-400">{mv === 7 ? '7+' : mv}</span>
        </div>
      ))}
    </div>
  );
}
