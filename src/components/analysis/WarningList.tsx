import type { Warning } from '../../analysis/warnings';
import { ManaText } from '../ui/ManaCost';

const STYLE: Record<Warning['severity'], { box: string; icon: string; label: string }> = {
  error: { box: 'border-red-400/40 bg-red-500/10', icon: 'bg-red-500 text-white', label: '!' },
  warning: { box: 'border-gold-400/40 bg-gold-400/10', icon: 'bg-gold-400 text-felt-950', label: '!' },
  info: { box: 'border-white/10 bg-white/5', icon: 'bg-stone-500 text-white', label: 'i' },
};

export default function WarningList({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-4 font-semibold text-emerald-200">
        ✓ Nessun problema rilevato nella mana base.
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {warnings.map((w) => {
        const style = STYLE[w.severity];
        return (
          <li key={w.id} className={`flex gap-3 rounded-2xl border px-4 py-3 ${style.box}`}>
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-black ${style.icon}`}
            >
              {style.label}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-stone-100">
                <ManaText text={w.title} />
              </p>
              {w.detail && <p className="mt-0.5 text-sm text-stone-400">{w.detail}</p>}
              {w.cards && w.cards.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {w.cards.map((c) => (
                    <span key={c} className="rounded-full bg-black/30 px-2.5 py-0.5 text-xs text-stone-300">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
