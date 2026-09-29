import { motion } from 'motion/react';
import type { OpeningHandStats } from '../../analysis/analyze';
import { pct } from './format';

export default function OpeningHandChart({ stats }: { stats: OpeningHandStats }) {
  const max = Math.max(...stats.distribution);

  return (
    <div className="space-y-5">
      <div className="flex h-40 items-end gap-1.5 sm:gap-2">
        {stats.distribution.map((p, lands) => {
          const keep = lands >= 2 && lands <= 5;
          return (
            <div key={lands} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[11px] text-stone-400 tabular-nums">{pct(p)}</span>
              <motion.div
                className={`w-full rounded-t-md ${keep ? 'bg-gradient-to-t from-emerald-700 to-emerald-400' : 'bg-gradient-to-t from-amber-700 to-amber-400'}`}
                initial={{ height: 0 }}
                animate={{ height: `${(p / max) * 100}%` }}
                transition={{ duration: 0.6, delay: lands * 0.04 }}
                style={{ minHeight: 2 }}
              />
              <span className="text-xs font-bold text-stone-300">{lands}</span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-stone-500">
        Terre nelle prime 7 carte, prima del mulligan. In verde le mani tenibili (2–5 terre):{' '}
        <strong className="text-stone-300">{pct(stats.keepable)}</strong>.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-stone-500">
            <tr>
              <th className="py-1.5 text-left font-medium">Land drop entro il turno</th>
              {stats.landDrops.map((d) => (
                <th key={d.turn} className="px-2 py-1.5 text-right font-medium">
                  T{d.turn}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {(['play', 'draw'] as const).map((side) => (
              <tr key={side} className="border-t border-white/5">
                <td className="py-1.5 text-stone-300">{side === 'play' ? 'On the play' : 'On the draw'}</td>
                {stats.landDrops.map((d) => (
                  <td key={d.turn} className="px-2 py-1.5 text-right">
                    {pct(d[side])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
