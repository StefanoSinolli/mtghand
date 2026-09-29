import type { CardProfile } from '../../analysis/cardProfile';
import { useSimulation } from '../../hooks/useSimulation';
import Button from '../ui/Button';
import ManaCost from '../ui/ManaCost';
import { pct } from './format';

interface SimulationPanelProps {
  profiles: CardProfile[];
  /** Carte giocabili solo in modo alternativo: non ha senso misurarne il lancio in curva */
  excludeCards: string[];
}

export default function SimulationPanel({ profiles, excludeCards }: SimulationPanelProps) {
  const { result, running, run } = useSimulation();
  const casts = result ? [...result.casts].sort((a, b) => a.onCurveGivenLands - b.onCurveGivenLands) : [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-400">
        Gioca 10.000 partite on the play con London mulligan e una terra a turno, tenendo conto delle terre che entrano
        tappate. Le fonti non-terra non sono considerate.
      </p>
      <Button variant={result ? 'secondary' : 'primary'} onClick={() => run(profiles, excludeCards)} disabled={running}>
        {running ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Simulazione in corso…
          </>
        ) : result ? (
          'Ripeti simulazione'
        ) : (
          'Avvia simulazione'
        )}
      </Button>

      {result && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniStat
              label="Mani tenute a 7"
              value={pct(result.mulligans[0])}
              hint={`1 mull ${pct(result.mulligans[1])} · 2+ ${pct(result.mulligans[2] + result.mulligans[3])}`}
            />
            <MiniStat label="3 terre al turno 3" value={pct(result.landDrops[2])} hint={`stappate ${pct(result.untappedLandDrops[2])}`} />
            <MiniStat label="4 terre al turno 4" value={pct(result.landDrops[3])} hint={`stappate ${pct(result.untappedLandDrops[3])}`} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-stone-500">
                <tr>
                  <th className="py-2 text-left font-medium">Carta</th>
                  <th className="px-2 py-2 text-left font-medium">Costo</th>
                  <th className="px-2 py-2 text-right font-medium">In curva</th>
                  <th className="py-2 text-right font-medium">Se hai le terre</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {casts.map((c) => (
                  <tr key={`${c.card}-${c.face}`} className="border-t border-white/5">
                    <td className={`py-1.5 ${c.onCurveGivenLands < 0.85 ? 'text-red-300' : 'text-stone-200'}`}>{c.face}</td>
                    <td className="px-2 py-1.5">
                      <ManaCost cost={c.manaCost} size="sm" />
                    </td>
                    <td className="px-2 py-1.5 text-right text-stone-400">{pct(c.onCurve)}</td>
                    <td className="py-1.5 text-right">
                      <span
                        className={`rounded-md px-1.5 py-0.5 font-semibold ${
                          c.onCurveGivenLands >= 0.9
                            ? 'text-emerald-300'
                            : c.onCurveGivenLands >= 0.85
                              ? 'text-gold-300'
                              : 'bg-red-500/15 text-red-300'
                        }`}
                      >
                        {pct(c.onCurveGivenLands)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-stone-500">
            "Se hai le terre" isola il problema dei colori: nelle partite con abbastanza terre al turno giusto, quante
            volte la carta era lanciabile.
          </p>
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-black/25 p-3">
      <p className="text-2xl font-bold text-stone-100 tabular-nums">{value}</p>
      <p className="text-xs font-medium text-stone-400">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}
