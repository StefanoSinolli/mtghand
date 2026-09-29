/**
 * Regole di warning sulla mana base
 */

import type { DeckAnalysis } from './analyze';
import { landColors } from './manaBase';
import { keyColors, type ManaSymbolColor } from './manaCost';

export type WarningSeverity = 'error' | 'warning' | 'info';

export interface Warning {
  id: string;
  severity: WarningSeverity;
  title: string;
  detail?: string;
  cards?: string[];
}

export const COLOR_NAMES: Record<ManaSymbolColor, string> = {
  W: 'bianco',
  U: 'blu',
  B: 'nero',
  R: 'rosso',
  G: 'verde',
  C: 'incolore',
};

export const colorLabel = (key: string) => keyColors(key).map((c) => COLOR_NAMES[c]).join(' o ');

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const formatSources = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const pct = (p: number) => `${Math.round(p * 100)}%`;

const SEVERITY_ORDER: Record<WarningSeverity, number> = { error: 0, warning: 1, info: 2 };

export const buildWarnings = (a: DeckAnalysis): Warning[] => {
  const warnings: Warning[] = [];

  if (a.missing.length > 0) {
    warnings.push({
      id: 'missing-cards',
      severity: 'warning',
      title: `${a.missing.length} carte non trovate su Scryfall: l'analisi le ignora`,
      cards: a.missing,
    });
  }

  if (a.deckSize < 60) {
    warnings.push({
      id: 'deck-size',
      severity: 'error',
      title: `Il mazzo ha ${a.deckSize} carte: nel Constructed il minimo è 60`,
    });
  } else if (a.deckSize > 60) {
    warnings.push({
      id: 'deck-size',
      severity: 'info',
      title: `Il mazzo ha ${a.deckSize} carte: con più di 60 carte peschi meno spesso quelle migliori`,
    });
  }

  if (a.lands.playable === 0) {
    warnings.push({ id: 'no-lands', severity: 'error', title: 'Il mazzo non contiene terre' });
    return warnings;
  }

  // --- Colori ---------------------------------------------------------------
  const demanded = new Set(a.colors.flatMap((c) => keyColors(c.key)));
  const demandedAlternative = new Set(a.alternativeChecks.flatMap((c) => keyColors(c.key)));

  for (const p of a.profiles) {
    if (!p.land) continue;
    const colored = [...landColors(p.land, a.profiles)].filter((c) => c !== 'C');
    if (colored.length === 0 || colored.some((c) => demanded.has(c))) continue;

    const names = colored.map((c) => COLOR_NAMES[c]).join(' e ');
    const onlyAlternative = colored.some((c) => demandedAlternative.has(c));
    warnings.push({
      id: `off-color-${p.name}`,
      severity: onlyAlternative ? 'info' : 'warning',
      title: onlyAlternative
        ? `${p.name} produce mana ${names}, usato solo da facce alternative (split/avventure)`
        : `${p.name} produce mana ${names}, ma nessuna carta del mazzo lo richiede`,
      detail: `${p.quantity} ${p.quantity === 1 ? 'copia che non aiuta' : 'copie che non aiutano'} a lanciare le tue magie.`,
      cards: [p.name],
    });
  }

  for (const color of a.colors) {
    if (color.ok) continue;
    const failing = color.checks.filter((c) => !c.ok);
    const worst = color.worst;
    const sources = worst.sources.total;
    const label = colorLabel(color.key);

    let severity: WarningSeverity = 'warning';
    if (sources === 0 || worst.required === null || worst.ratio < 0.75) severity = 'error';

    const requirement =
      worst.required === null
        ? `non è lanciabile in curva con ${Math.round(a.lands.weighted)} terre`
        : `ne richiede ${worst.required}`;

    warnings.push({
      id: `color-${color.key}`,
      severity,
      title:
        sources === 0
          ? `Nessuna fonte di ${label}, ma ${failing.length} ${failing.length === 1 ? 'carta lo richiede' : 'carte lo richiedono'}`
          : `${capitalize(label)}: ${formatSources(sources)} fonti. ${worst.face} (${worst.manaCost} al turno ${worst.turn}) ${requirement}`,
      detail:
        worst.sources.support > 0
          ? `Incluse ${formatSources(worst.sources.support)} fonti non-terra (${worst.sources.supportNames.join(', ')}).`
          : undefined,
      cards: [...new Set(failing.map((c) => c.card))],
    });
  }

  for (const check of a.alternativeChecks) {
    if (check.ok) continue;
    warnings.push({
      id: `alt-${check.face}-${check.key}`,
      severity: 'info',
      title: `${check.face} (${check.manaCost}) ha poche fonti di ${colorLabel(check.key)}: ${formatSources(check.sources.total)}/${check.required ?? '—'}`,
      detail: 'È una faccia alternativa: puoi comunque giocare l\'altra metà della carta.',
      cards: [check.card],
    });
  }

  // --- Numero di terre ------------------------------------------------------
  const { current, recommended, averageManaValue } = a.landCount;
  const delta = current - recommended;
  if (Math.abs(delta) >= 1) {
    warnings.push({
      id: 'land-count',
      severity: Math.abs(delta) >= 2 ? 'warning' : 'info',
      title: `${delta < 0 ? 'Poche' : 'Troppe'} terre: ne hai ${formatSources(current)}, ne servono circa ${recommended.toFixed(1)}`,
      detail: [
        `Formula di Karsten con costo medio ${averageManaValue.toFixed(2)} e ${a.landCount.cheapDrawOrRamp.reduce((s, c) => s + c.quantity, 0)} pescate/ramp economici.`,
        a.lands.landcyclers > 0 && `Le ${a.lands.landcyclers} carte con landcycling contano come mezza terra.`,
        a.landCount.costReduced.length > 0 &&
          `Costo effettivo stimato per ${a.landCount.costReduced.map((c) => `${c.name} (${c.printed}→${c.effective})`).join(', ')}.`,
      ]
        .filter(Boolean)
        .join(' '),
    });
  }

  // Mani da 0–1 o 6–7 terre: sono un problema solo se il numero di terre non è quello giusto;
  // altrimenti è la normale varianza del mazzo (es. aggro con 17 terre), gestita dal mulligan
  const { screw, flood } = a.openingHand;
  if (screw > 0.2) {
    warnings.push({
      id: 'screw',
      severity: delta <= -1 ? 'warning' : 'info',
      title: `${pct(screw)} di probabilità di aprire con 0–1 terre`,
      detail: delta <= -1 ? undefined : 'In linea con il numero di terre consigliato: il mulligan compensa queste mani.',
    });
  }
  if (flood > 0.1) {
    warnings.push({
      id: 'flood',
      severity: delta >= 1 ? 'warning' : 'info',
      title: `${pct(flood)} di probabilità di aprire con 6–7 terre`,
      detail: delta >= 1 ? undefined : 'In linea con il numero di terre consigliato: il mulligan compensa queste mani.',
    });
  }

  // --- Terre tappate e incolori --------------------------------------------
  const alwaysTapped = a.tapped.always.reduce((s, t) => s + t.quantity, 0);
  if (alwaysTapped > 0 && alwaysTapped / a.lands.playable > 0.25) {
    warnings.push({
      id: 'tapped',
      severity: 'warning',
      title: `${alwaysTapped} terre su ${a.lands.playable} entrano sempre tappate`,
      detail: 'Troppe terre tappate rallentano la curva, soprattutto nei mazzi aggressivi.',
      cards: a.tapped.always.map((t) => t.name),
    });
  } else if (alwaysTapped >= 3 && averageManaValue < 2.2) {
    warnings.push({
      id: 'tapped',
      severity: 'info',
      title: `${alwaysTapped} terre sempre tappate in un mazzo con costo medio basso (${averageManaValue.toFixed(2)})`,
      cards: a.tapped.always.map((t) => t.name),
    });
  }

  const colorless = a.profiles.filter(
    (p) => p.land && ![...landColors(p.land, a.profiles)].some((c) => c !== 'C'),
  );
  const colorlessCount = colorless.reduce((s, p) => s + p.quantity, 0);
  const hasHeavyRequirements = a.colors.some((c) => c.key !== 'C' && c.checks.some((ch) => ch.pips >= 2));
  if (colorlessCount > 0 && hasHeavyRequirements) {
    warnings.push({
      id: 'colorless',
      severity: 'info',
      title: `${colorlessCount} terre producono solo mana incolore`,
      detail: 'Non contano come fonti per i costi colorati come {U}{U} o {R}{R}.',
      cards: colorless.map((p) => p.name),
    });
  }

  const support = a.profiles.filter((p) => p.nonLandSource);
  if (support.length > 0) {
    warnings.push({
      id: 'support-sources',
      severity: 'info',
      title: 'Fonti di mana non-terra conteggiate',
      detail:
        'Contano solo per le carte che costano più di loro; le creature valgono mezza fonte perché più facili da rimuovere.',
      cards: support.map((p) => `${p.name} (${p.nonLandSource!.weight === 1 ? 'fonte piena' : 'mezza fonte'})`),
    });
  }

  return warnings.sort((x, y) => SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity]);
};
