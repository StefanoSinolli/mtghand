import { useMemo } from 'react';
import { analyzeDeck, type DeckAnalysis } from '../analysis/analyze';
import { applyBasicChanges } from '../analysis/applyProposal';
import { colorLabel } from '../analysis/warnings';
import BasicsProposal from '../components/analysis/BasicsProposal';
import ColorSources from '../components/analysis/ColorSources';
import OpeningHandChart from '../components/analysis/OpeningHandChart';
import SimulationPanel from '../components/analysis/SimulationPanel';
import WarningList from '../components/analysis/WarningList';
import { num, pct } from '../components/analysis/format';
import Button from '../components/ui/Button';
import Panel from '../components/ui/Panel';
import { useConfirm } from '../components/ui/confirm';
import { saveDeck } from '../store/decks';
import { useDeckContext } from './deckContext';

export default function AnalysisPage() {
  const { deck, cards, loading, error } = useDeckContext();
  const analysis = useMemo(() => (loading ? null : analyzeDeck(deck, cards)), [deck, cards, loading]);

  if (error) {
    return <p className="py-24 text-center text-red-300">⚠️ {error}: impossibile analizzare il mazzo.</p>;
  }
  if (loading || !analysis) {
    return <p className="animate-pulse py-24 text-center text-stone-400">Analizzo la mana base…</p>;
  }

  return (
    <div className="space-y-6">
      <Summary analysis={analysis} />

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Panel title="Segnalazioni">
            <WarningList warnings={analysis.warnings} />
          </Panel>
          {analysis.colors.length > 0 && (
            <Panel title="Fonti per colore" subtitle="Fonti presenti rispetto a quelle necessarie per lanciare in curva">
              <ColorSources colors={analysis.colors} />
            </Panel>
          )}
          <Proposals analysis={analysis} />
        </div>

        <div className="min-w-0 space-y-6">
          <LandCount analysis={analysis} />
          <Panel title="Mano iniziale">
            <OpeningHandChart stats={analysis.openingHand} />
          </Panel>
          <Panel title="Simulazione">
            <SimulationPanel profiles={analysis.profiles} />
          </Panel>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-stone-500">
        Soglie calcolate con il modello di Frank Karsten: una carta è consistente se, avendo abbastanza terre, la
        probabilità di avere le fonti colorate entro il suo turno è almeno (89 + costo)%. Numero di terre: regressione di
        Karsten 19.59 + 1.90 × costo medio − 0.28 × pescate/ramp economici + 0.27 × companion. MDFC e carte con
        landcycling contano come mezza terra; le carte con riduzione di costo (Delve, Affinity, "costa {'{1}'} in meno
        per ogni…") usano un costo effettivo stimato: simboli colorati più al massimo 1 generico.
      </p>
    </div>
  );
}

function Summary({ analysis }: { analysis: DeckAnalysis }) {
  const errors = analysis.warnings.filter((w) => w.severity === 'error').length;
  const warnings = analysis.warnings.filter((w) => w.severity === 'warning').length;
  const verdict =
    errors > 0
      ? { text: `${errors} ${errors === 1 ? 'problema' : 'problemi'}`, tone: 'text-red-300 border-red-400/40' }
      : warnings > 0
        ? { text: `${warnings} ${warnings === 1 ? 'avviso' : 'avvisi'}`, tone: 'text-gold-300 border-gold-400/40' }
        : { text: 'Mana base solida', tone: 'text-emerald-300 border-emerald-400/40' };

  const delta = analysis.lands.weighted - analysis.landCount.recommended;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className={`glass rounded-2xl border-2 p-4 ${verdict.tone}`}>
        <p className="text-xl font-bold">{verdict.text}</p>
        <p className="text-xs text-stone-400">Esito dell'analisi</p>
      </div>
      <SummaryStat
        value={num(analysis.lands.weighted)}
        label="Terre"
        hint={`consigliate ${analysis.landCount.recommended.toFixed(1)}${Math.abs(delta) >= 1 ? (delta > 0 ? ' ↓' : ' ↑') : ' ✓'}`}
      />
      <SummaryStat value={analysis.landCount.averageManaValue.toFixed(2)} label="Costo medio" />
      <SummaryStat value={pct(analysis.openingHand.keepable)} label="Mani con 2–5 terre" />
    </div>
  );
}

function SummaryStat({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-2xl font-bold text-stone-50 tabular-nums">{value}</p>
      <p className="text-xs text-stone-400">
        {label}
        {hint && <span className="text-stone-500"> · {hint}</span>}
      </p>
    </div>
  );
}

function Proposals({ analysis }: { analysis: DeckAnalysis }) {
  const { deck } = useDeckContext();
  const confirm = useConfirm();
  const { optimizer, optimizerWithLandCount } = analysis;
  if (!optimizer) return null;

  const apply = async () => {
    const ok = await confirm({
      title: 'Applicare le modifiche?',
      message: (
        <ul className="space-y-1">
          {optimizer.changes.map((c) => (
            <li key={c.name}>
              {c.name}: {c.from} → <strong>{c.to}</strong>
            </li>
          ))}
        </ul>
      ),
      confirmLabel: 'Applica al mazzo',
    });
    if (ok) saveDeck(applyBasicChanges(deck, optimizer.changes));
  };

  const failing = analysis.colors.filter((c) => !c.ok).map((c) => colorLabel(c.key));

  return (
    <Panel title="Terre base consigliate" subtitle="Le terre non-base restano invariate">
      {optimizer.changes.length === 0 ? (
        <p className="text-stone-300">
          Con {num(optimizer.landCount)} terre la distribuzione attuale delle base è già la migliore possibile.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-stone-300">A parità di terre ({num(optimizer.landCount)}):</p>
          <BasicsProposal proposal={optimizer} />
          <Button variant="primary" onClick={apply}>
            Applica al mazzo
          </Button>
        </div>
      )}

      {!optimizer.feasible && (
        <p className="mt-4 rounded-xl border border-gold-400/30 bg-gold-400/10 px-4 py-3 text-sm text-gold-100">
          Nessuna combinazione di sole terre base soddisfa tutti i requisiti
          {failing.length > 0 && ` (${failing.join(', ')})`}: servono terre doppie o fetch che producano più colori.
        </p>
      )}

      {optimizerWithLandCount && (
        <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
          <p className="text-sm text-stone-300">
            Con le <strong>{num(optimizerWithLandCount.landCount)}</strong> terre consigliate:{' '}
            {optimizerWithLandCount.landDelta > 0 ? 'togli' : 'aggiungi'} {Math.abs(optimizerWithLandCount.landDelta)}{' '}
            {Math.abs(optimizerWithLandCount.landDelta) === 1 ? 'magia' : 'magie'} a tua scelta e
          </p>
          <BasicsProposal proposal={optimizerWithLandCount} />
        </div>
      )}
    </Panel>
  );
}

function LandCount({ analysis }: { analysis: DeckAnalysis }) {
  const { landCount, lands, tapped } = analysis;
  const cheap = landCount.cheapDrawOrRamp.reduce((s, c) => s + c.quantity, 0);
  const halfLands = lands.mdfc + lands.landcyclers;

  return (
    <Panel title="Numero di terre">
      <div className="flex items-end gap-6">
        <div>
          <p className="text-4xl font-bold text-stone-50 tabular-nums">{num(lands.weighted)}</p>
          <p className="text-xs text-stone-400">
            {halfLands > 0
              ? `effettive (${lands.playable - halfLands} terre + ${halfLands} × ½)`
              : 'nel mazzo'}
          </p>
        </div>
        <div>
          <p className="text-4xl font-bold text-gold-300 tabular-nums">{landCount.recommended.toFixed(1)}</p>
          <p className="text-xs text-stone-400">consigliate</p>
        </div>
      </div>
      <ul className="mt-4 space-y-1.5 text-sm text-stone-400">
        {lands.mdfc > 0 && <li>{lands.mdfc} MDFC contate come mezza terra</li>}
        {landCount.landcyclers.length > 0 && (
          <li>
            Contate come mezza terra (landcycling):{' '}
            <span className="text-stone-300">
              {landCount.landcyclers.map((c) => `${c.quantity} ${c.name}`).join(', ')}
            </span>
          </li>
        )}
        {landCount.costReduced.length > 0 && (
          <li>
            Costo effettivo stimato:{' '}
            <span className="text-stone-300">
              {landCount.costReduced.map((c) => `${c.name} ${c.printed}→${c.effective}`).join(', ')}
            </span>
          </li>
        )}
        <li>
          Pescate/ramp economici ({cheap}):{' '}
          <span className="text-stone-300">
            {landCount.cheapDrawOrRamp.map((c) => `${c.quantity} ${c.name}`).join(', ') || 'nessuno'}
          </span>
        </li>
        {landCount.hasCompanion && <li>Companion in sideboard</li>}
        {tapped.always.length > 0 && (
          <li>
            Sempre tappate:{' '}
            <span className="text-stone-300">{tapped.always.map((t) => `${t.quantity} ${t.name}`).join(', ')}</span>
          </li>
        )}
        {tapped.conditional.length > 0 && (
          <li>
            Tappate a condizione:{' '}
            <span className="text-stone-300">{tapped.conditional.map((t) => `${t.quantity} ${t.name}`).join(', ')}</span>
          </li>
        )}
      </ul>
    </Panel>
  );
}
