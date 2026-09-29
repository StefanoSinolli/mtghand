import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { ColorSummary } from '../../analysis/analyze';
import { colorLabel } from '../../analysis/warnings';
import ManaCost, { ColorKey } from '../ui/ManaCost';
import { num } from './format';

export default function ColorSources({ colors }: { colors: ColorSummary[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {colors.map((c) => {
        const required = c.worst.required;
        const sources = c.worst.sources.total;
        const scale = Math.max(sources, required ?? 0, 1) * 1.1;
        const tone = c.ok ? 'from-emerald-600 to-emerald-400' : c.worst.ratio >= 0.75 ? 'from-gold-600 to-gold-400' : 'from-red-700 to-red-500';

        return (
          <div key={c.key} className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
            <button
              className="grid w-full cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-3 text-left hover:bg-white/5 sm:grid-cols-[auto_7rem_1fr_auto]"
              onClick={() => setOpen(open === c.key ? null : c.key)}
              aria-expanded={open === c.key}
            >
              <ColorKey colorKey={c.key} size="lg" />
              <span className="font-semibold capitalize text-stone-100">{colorLabel(c.key)}</span>
              <span className="text-right font-bold tabular-nums text-stone-100 sm:order-last">
                {num(sources)}
                <span className="text-stone-500"> / {required ?? '—'}</span>
              </span>
              <div className="relative col-span-3 h-3 rounded-full bg-white/10 sm:col-span-1">
                <motion.div
                  className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${tone}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${(sources / scale) * 100}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
                {required !== null && (
                  <div
                    className="absolute -inset-y-1 w-0.5 rounded bg-stone-100"
                    style={{ left: `${(required / scale) * 100}%` }}
                    title={`Richieste: ${required}`}
                  />
                )}
              </div>
            </button>
            <p className="px-4 pb-3 text-xs text-stone-400">
              {c.ok ? 'Più esigente' : 'Critica'}: <span className="text-stone-200">{c.worst.face}</span>
              {c.worst.commander && <CommanderBadge />}{' '}
              <ManaCost cost={c.worst.manaCost} size="sm" /> al turno {c.worst.turn}
              {c.worst.sources.support > 0 && ` · incluse ${num(c.worst.sources.support)} fonti non-terra`}
            </p>

            <AnimatePresence>
              {open === c.key && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-white/10"
                >
                  <table className="w-full text-sm">
                    <thead className="text-xs text-stone-500">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Carta</th>
                        <th className="px-2 py-2 text-left font-medium">Costo</th>
                        <th className="px-2 py-2 text-right font-medium">Turno</th>
                        <th className="px-4 py-2 text-right font-medium">Fonti / richieste</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.checks.map((check) => (
                        <tr key={`${check.card}-${check.face}`} className="border-t border-white/5">
                          <td className={`px-4 py-1.5 ${check.ok ? 'text-stone-200' : 'text-red-300'}`}>
                            {check.face}
                            {check.commander ? <CommanderBadge /> : <span className="text-stone-500"> ×{check.copies}</span>}
                          </td>
                          <td className="px-2 py-1.5">
                            <ManaCost cost={check.manaCost} size="sm" />
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{check.turn}</td>
                          <td className="px-4 py-1.5 text-right tabular-nums">
                            {num(check.sources.total)} / {check.required ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
      <p className="text-xs text-stone-500">
        La linea bianca indica le fonti necessarie. Clicca su un colore per vedere tutte le carte.
      </p>
    </div>
  );
}

function CommanderBadge() {
  return (
    <span className="ml-1.5 rounded bg-gold-400/15 px-1.5 py-px text-[10px] font-bold tracking-wide text-gold-300 uppercase">
      Comandante
    </span>
  );
}
