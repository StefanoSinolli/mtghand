import type { OptimizerProposal } from '../../analysis/optimizer';
import { ColorKey } from '../ui/ManaCost';
import { num } from './format';

export default function BasicsProposal({ proposal }: { proposal: OptimizerProposal }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {proposal.changes.map((c) => {
          const diff = c.to - c.from;
          return (
            <span
              key={c.name}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                diff > 0 ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-red-400/30 bg-red-500/10'
              }`}
            >
              <span className={`font-black ${diff > 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {diff > 0 ? '+' : '−'}
                {Math.abs(diff)}
              </span>
              <span className="font-semibold text-stone-100">{c.name}</span>
              <span className="text-xs text-stone-500">
                {c.from} → {c.to}
              </span>
            </span>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {proposal.sources.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1">
            <ColorKey colorKey={s.key} size="sm" />
            <span className="text-stone-400">{num(s.before)}</span>
            <span className="text-stone-600">→</span>
            <span className="font-semibold text-stone-100">{num(s.after)}</span>
            <span className="text-stone-500">fonti</span>
          </span>
        ))}
      </div>
      <p className="text-xs text-stone-500">
        Copie di magie con abbastanza fonti: {proposal.before.satisfiedCopies} → {proposal.after.satisfiedCopies} su{' '}
        {proposal.after.totalCopies}
      </p>
    </div>
  );
}
