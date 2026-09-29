import { useMemo, useState } from 'react';
import { analyzeDeck, type ColorSummary, type DeckAnalysis } from '../analysis/analyze';
import { applyBasicChanges } from '../analysis/applyProposal';
import type { OptimizerProposal } from '../analysis/optimizer';
import { colorLabel, type Warning } from '../analysis/warnings';
import { useDeckCards } from '../hooks/useDeckCards';
import { useSimulation } from '../hooks/useSimulation';
import type { Deck } from '../types';
import ManaCost, { ColorKey } from './ui/ManaCost';
import './Analysis.css';

interface AnalysisProps {
  deck: Deck;
  onDeckUpdated: (deck: Deck) => void;
  onPlay: () => void;
}

const pct = (p: number) => `${Math.round(p * 100)}%`;
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const SEVERITY_ICON: Record<Warning['severity'], string> = { error: '⛔', warning: '⚠️', info: 'ℹ️' };

export default function Analysis({ deck, onDeckUpdated, onPlay }: AnalysisProps) {
  const { cards, loading, error } = useDeckCards(deck);
  const analysis = useMemo(() => (loading ? null : analyzeDeck(deck, cards)), [deck, cards, loading]);

  if (loading) return <div className="analysis-loading">Analisi in corso: carico i dati delle carte…</div>;
  if (error || !analysis) return <div className="analysis-loading">⚠️ {error ?? 'Analisi non disponibile'}</div>;

  return (
    <div className="analysis">
      <div className="analysis-header">
        <div>
          <h2>Analisi mana base</h2>
          <p className="analysis-subtitle">{deck.name}</p>
        </div>
        <button className="btn-secondary" onClick={onPlay}>
          🎴 Simula mano
        </button>
      </div>

      <Summary analysis={analysis} />
      <Warnings warnings={analysis.warnings} />
      <Colors colors={analysis.colors} />
      <Optimizer analysis={analysis} deck={deck} onDeckUpdated={onDeckUpdated} />
      <LandCount analysis={analysis} />
      <OpeningHand analysis={analysis} />
      <Simulation analysis={analysis} />

      <p className="analysis-footnote">
        Soglie calcolate con il modello di Frank Karsten (probabilità di lanciare una carta in curva ≥ 89% + costo, avendo
        abbastanza terre). Numero di terre consigliato: regressione di Karsten 19.59 + 1.90 × costo medio − 0.28 ×
        pescate/ramp economici.
      </p>
    </div>
  );
}

function Summary({ analysis }: { analysis: DeckAnalysis }) {
  const errors = analysis.warnings.filter((w) => w.severity === 'error').length;
  const warnings = analysis.warnings.filter((w) => w.severity === 'warning').length;

  return (
    <div className="analysis-summary">
      <Stat label="Carte" value={String(analysis.deckSize)} />
      <Stat label="Terre" value={num(analysis.lands.weighted)} hint={`consigliate ~${analysis.landCount.recommended.toFixed(1)}`} />
      <Stat label="Costo medio" value={analysis.landCount.averageManaValue.toFixed(2)} />
      <Stat label="Mano con 2–5 terre" value={pct(analysis.openingHand.keepable)} />
      <Stat
        label="Esito"
        value={
          errors > 0
            ? `${errors} ${errors === 1 ? 'problema' : 'problemi'}`
            : warnings > 0
              ? `${warnings} ${warnings === 1 ? 'avviso' : 'avvisi'}`
              : 'Tutto ok'
        }
        tone={errors > 0 ? 'bad' : warnings > 0 ? 'warn' : 'good'}
      />
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ''}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

function Warnings({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) {
    return <section className="analysis-section">✅ Nessun problema rilevato nella mana base.</section>;
  }

  return (
    <section className="analysis-section">
      <h3>Segnalazioni</h3>
      <ul className="warning-list">
        {warnings.map((w) => (
          <li key={w.id} className={`warning warning-${w.severity}`}>
            <span className="warning-icon">{SEVERITY_ICON[w.severity]}</span>
            <div>
              <div className="warning-title">{w.title}</div>
              {w.detail && <div className="warning-detail">{w.detail}</div>}
              {w.cards && w.cards.length > 0 && (
                <div className="chips">
                  {w.cards.map((c) => (
                    <span key={c} className="chip">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Colors({ colors }: { colors: ColorSummary[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (colors.length === 0) return null;

  return (
    <section className="analysis-section">
      <h3>Fonti per colore</h3>
      <div className="color-rows">
        {colors.map((c) => {
          const required = c.worst.required;
          const sources = c.worst.sources.total;
          const ratio = required ? Math.min(1, sources / required) : 0;
          return (
            <div key={c.key} className="color-row">
              <button className="color-row-main" onClick={() => setOpen(open === c.key ? null : c.key)}>
                <ColorKey colorKey={c.key} />
                <span className="color-name">{colorLabel(c.key)}</span>
                <div className="bar">
                  <div className={`bar-fill ${c.ok ? 'ok' : ratio >= 0.75 ? 'warn' : 'bad'}`} style={{ width: `${ratio * 100}%` }} />
                </div>
                <span className="color-numbers">
                  {num(sources)} / {required ?? '—'}
                </span>
                <span className="color-worst">
                  {c.ok ? 'più esigente' : 'critica'}: {c.worst.face} <ManaCost cost={c.worst.manaCost} />
                </span>
              </button>

              {open === c.key && (
                <table className="checks-table">
                  <thead>
                    <tr>
                      <th>Carta</th>
                      <th>Costo</th>
                      <th>Turno</th>
                      <th>Fonti</th>
                      <th>Richieste</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.checks.map((check) => (
                      <tr key={`${check.card}-${check.face}`} className={check.ok ? '' : 'row-bad'}>
                        <td>
                          {check.face} ×{check.copies}
                        </td>
                        <td>
                          <ManaCost cost={check.manaCost} />
                        </td>
                        <td>{check.turn}</td>
                        <td>
                          {num(check.sources.total)}
                          {check.sources.support > 0 && <small> (+{num(check.sources.support)} non-terra)</small>}
                        </td>
                        <td>{check.required ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
      <p className="section-note">Clicca su un colore per vedere tutte le carte che lo richiedono.</p>
    </section>
  );
}

function ProposalChanges({ proposal }: { proposal: OptimizerProposal }) {
  return (
    <>
      <ul className="changes">
        {proposal.changes.map((c) => (
          <li key={c.name}>
            <span className={c.to > c.from ? 'plus' : 'minus'}>
              {c.to > c.from ? '+' : '−'}
              {Math.abs(c.to - c.from)}
            </span>{' '}
            {c.name} <small>({c.from} → {c.to})</small>
          </li>
        ))}
      </ul>
      <div className="chips">
        {proposal.sources.map((s) => (
          <span key={s.key} className="chip">
            <ColorKey colorKey={s.key} /> {num(s.before)} → {num(s.after)} fonti
          </span>
        ))}
      </div>
      <p className="section-note">
        Copie di magie con abbastanza fonti: {proposal.before.satisfiedCopies} → {proposal.after.satisfiedCopies} su{' '}
        {proposal.after.totalCopies}
      </p>
    </>
  );
}

function Optimizer({ analysis, deck, onDeckUpdated }: { analysis: DeckAnalysis; deck: Deck; onDeckUpdated: (deck: Deck) => void }) {
  const { optimizer, optimizerWithLandCount } = analysis;
  if (!optimizer) return null;

  const apply = () => {
    const summary = optimizer.changes.map((c) => `${c.name}: ${c.from} → ${c.to}`).join('\n');
    if (confirm(`Applicare queste modifiche al mazzo?\n\n${summary}`)) {
      onDeckUpdated(applyBasicChanges(deck, optimizer.changes));
    }
  };

  return (
    <section className="analysis-section">
      <h3>Terre base consigliate</h3>

      {optimizer.changes.length === 0 ? (
        <p>Con {num(optimizer.landCount)} terre la distribuzione attuale delle base è già la migliore possibile.</p>
      ) : (
        <>
          <p>A parità di terre ({num(optimizer.landCount)}), questa distribuzione delle base migliora le fonti:</p>
          <ProposalChanges proposal={optimizer} />
          <button className="btn-primary" onClick={apply}>
            Applica al mazzo
          </button>
        </>
      )}

      {!optimizer.feasible && (
        <p className="notice">
          ⚠️ Nessuna combinazione di sole terre base soddisfa tutti i requisiti: servono terre doppie o fetch che
          producano più colori ({analysis.colors.filter((c) => !c.ok).map((c) => colorLabel(c.key)).join(', ')}).
        </p>
      )}

      {optimizerWithLandCount && (
        <div className="alt-proposal">
          <h4>
            Con {num(optimizerWithLandCount.landCount)} terre (consigliate), {optimizerWithLandCount.landDelta > 0 ? 'togli' : 'aggiungi'}{' '}
            {Math.abs(optimizerWithLandCount.landDelta)} {Math.abs(optimizerWithLandCount.landDelta) === 1 ? 'magia' : 'magie'} a tua scelta e:
          </h4>
          <ProposalChanges proposal={optimizerWithLandCount} />
        </div>
      )}
    </section>
  );
}

function LandCount({ analysis }: { analysis: DeckAnalysis }) {
  const { landCount, lands, tapped } = analysis;
  return (
    <section className="analysis-section">
      <h3>Numero di terre</h3>
      <p>
        Hai <strong>{num(lands.weighted)}</strong> terre
        {lands.mdfc > 0 && ` (${lands.mdfc} MDFC contate a metà)`}; per questo mazzo ne servono circa{' '}
        <strong>{landCount.recommended.toFixed(1)}</strong>.
      </p>
      <ul className="facts">
        <li>Costo medio delle magie: {landCount.averageManaValue.toFixed(2)}</li>
        <li>
          Pescate/ramp economici ({landCount.cheapDrawOrRamp.reduce((s, c) => s + c.quantity, 0)}):{' '}
          {landCount.cheapDrawOrRamp.map((c) => `${c.quantity} ${c.name}`).join(', ') || 'nessuna'}
        </li>
        {landCount.hasCompanion && <li>Companion in sideboard (+0.27)</li>}
        {tapped.always.length > 0 && (
          <li>Sempre tappate: {tapped.always.map((t) => `${t.quantity} ${t.name}`).join(', ')}</li>
        )}
        {tapped.conditional.length > 0 && (
          <li>Tappate a condizione: {tapped.conditional.map((t) => `${t.quantity} ${t.name}`).join(', ')}</li>
        )}
      </ul>
    </section>
  );
}

function OpeningHand({ analysis }: { analysis: DeckAnalysis }) {
  const { distribution, landDrops } = analysis.openingHand;
  const max = Math.max(...distribution);

  return (
    <section className="analysis-section">
      <h3>Mano iniziale</h3>
      <div className="histogram">
        {distribution.map((p, lands) => (
          <div key={lands} className={`histogram-col ${lands >= 2 && lands <= 5 ? 'keep' : 'risk'}`}>
            <span className="histogram-value">{pct(p)}</span>
            <div className="histogram-bar" style={{ height: `${(p / max) * 100}%` }} />
            <span className="histogram-label">{lands}</span>
          </div>
        ))}
      </div>
      <p className="section-note">Terre nelle 7 carte iniziali (prima del mulligan).</p>

      <table className="checks-table compact">
        <thead>
          <tr>
            <th>Land drop</th>
            {landDrops.map((d) => (
              <th key={d.turn}>T{d.turn}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>On the play</td>
            {landDrops.map((d) => (
              <td key={d.turn}>{pct(d.play)}</td>
            ))}
          </tr>
          <tr>
            <td>On the draw</td>
            {landDrops.map((d) => (
              <td key={d.turn}>{pct(d.draw)}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function Simulation({ analysis }: { analysis: DeckAnalysis }) {
  const { result, running, run } = useSimulation();
  const casts = result ? [...result.casts].sort((a, b) => a.onCurveGivenLands - b.onCurveGivenLands) : [];

  return (
    <section className="analysis-section">
      <h3>Simulazione</h3>
      <p>
        Gioca 10.000 partite on the play con London mulligan e una terra a turno, considerando le terre che entrano
        tappate. Le fonti non-terra non sono considerate.
      </p>
      <button className="btn-secondary" onClick={() => run(analysis.profiles)} disabled={running}>
        {running ? 'Simulazione in corso…' : result ? 'Ripeti simulazione' : 'Avvia simulazione'}
      </button>

      {result && (
        <>
          <ul className="facts">
            <li>
              Mulligan: {result.mulligans.map((m, i) => `${i === 0 ? 'nessuno' : i === 3 ? '3+' : i} ${pct(m)}`).join(' · ')}
            </li>
            <li>
              Land drop in gioco: {result.landDrops.map((d, i) => `T${i + 1} ${pct(d)}`).join(' · ')}
            </li>
            <li>
              Terre utilizzabili (non tappate): {result.untappedLandDrops.map((d, i) => `T${i + 1} ${pct(d)}`).join(' · ')}
            </li>
          </ul>
          <table className="checks-table">
            <thead>
              <tr>
                <th>Carta</th>
                <th>Costo</th>
                <th>In curva</th>
                <th>In curva se hai le terre</th>
              </tr>
            </thead>
            <tbody>
              {casts.map((c) => (
                <tr key={`${c.card}-${c.face}`} className={c.onCurveGivenLands < 0.85 ? 'row-bad' : ''}>
                  <td>{c.face}</td>
                  <td>
                    <ManaCost cost={c.manaCost} />
                  </td>
                  <td>{pct(c.onCurve)}</td>
                  <td>{pct(c.onCurveGivenLands)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="section-note">
            "Se hai le terre" misura solo il problema dei colori: su quante partite con abbastanza terre al turno giusto
            la carta era lanciabile.
          </p>
        </>
      )}
    </section>
  );
}
