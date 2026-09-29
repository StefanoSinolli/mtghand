/**
 * Regole di warning sulla mana base
 */

import type { DeckAnalysis } from './analyze';
import { landColors, type LandTotals } from './manaBase';
import type { CardProfile } from './cardProfile';
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

/**
 * Terre vere e fonti extra (MDFC e landcycler) tenute distinte:
 * "16 terre + 4 fonti extra" invece di 18 terre "equivalenti"
 */
export const splitLands = (lands: LandTotals) => {
  const extra = lands.mdfc + lands.landcyclers;
  return { real: lands.playable - extra, extra, equivalent: lands.weighted };
};

export const describeLands = (lands: LandTotals) => {
  const { real, extra, equivalent } = splitLands(lands);
  return extra === 0
    ? `${formatSources(equivalent)} terre`
    : `${real} terre + ${extra} ${extra === 1 ? 'fonte extra' : 'fonti extra'} (valgono ${formatSources(equivalent)})`;
};

const pct = (p: number) => `${Math.round(p * 100)}%`;

const SEVERITY_ORDER: Record<WarningSeverity, number> = { error: 0, warning: 1, info: 2 };

const oracleOf = (p: CardProfile) =>
  [p.card.oracle_text, ...(p.card.card_faces ?? []).map((f) => f.oracle_text)].filter(Boolean).join('\n');

const frontTypeOf = (p: CardProfile) => p.card.card_faces?.[0]?.type_line ?? p.card.type_line;

/** Carte che ignorano il limite di copie ("A deck can have any number of cards named …") */
const anyNumberAllowed = (p: CardProfile) =>
  p.land?.isBasic === true || /a deck can have any number of cards named/i.test(oracleOf(p));

const constructedWarnings = (a: DeckAnalysis): Warning[] => {
  const warnings: Warning[] = [];
  const min = a.rules.deckSize;

  if (a.deckSize < min) {
    warnings.push({ id: 'deck-size', severity: 'error', title: `Il mazzo ha ${a.deckSize} carte: nel Constructed il minimo è ${min}` });
  } else if (a.deckSize > min) {
    warnings.push({
      id: 'deck-size',
      severity: 'info',
      title: `Il mazzo ha ${a.deckSize} carte: con più di ${min} carte peschi meno spesso quelle migliori`,
    });
  }

  const tooMany = a.profiles.filter((p) => p.quantity > a.rules.maxCopies && !anyNumberAllowed(p));
  if (tooMany.length > 0) {
    warnings.push({
      id: 'max-copies',
      severity: 'error',
      title: `Più di ${a.rules.maxCopies} copie di ${tooMany.length === 1 ? 'una carta' : `${tooMany.length} carte`}`,
      cards: tooMany.map((p) => `${p.quantity} ${p.name}`),
    });
  }
  return warnings;
};

/** Il comandante può esserlo? Creatura leggendaria (anche fuori dal campo) o "can be your commander" */
const canBeCommander = (p: CardProfile) =>
  /can be your commander/i.test(oracleOf(p)) ||
  (/\bLegendary\b/.test(frontTypeOf(p)) &&
    // Grist: "As long as Grist isn't on the battlefield, it's a 1/1 Insect creature in addition to its other types"
    (/\bCreature\b/.test(frontTypeOf(p)) || /creature in addition to its other types/i.test(oracleOf(p))));

const PAIRING = /\bPartner\b|Friends forever|Doctor's companion|Choose a Background/i;

const commanderWarnings = (a: DeckAnalysis): Warning[] => {
  const warnings: Warning[] = [];
  const total = a.deckSize + a.commanders.reduce((s, c) => s + c.quantity, 0);

  if (a.commanders.length === 0) {
    warnings.push({
      id: 'no-commander',
      severity: 'error',
      title: 'Nessun comandante indicato',
      detail: "Sceglilo nella scheda Modifica: senza comandante non si può controllare l'identità di colore.",
    });
  }

  if (total !== a.rules.deckSize) {
    warnings.push({
      id: 'deck-size',
      severity: 'error',
      title: `Il mazzo ha ${total} carte: nel Commander devono essere esattamente ${a.rules.deckSize}, comandante incluso`,
    });
  }

  for (const c of a.commanders) {
    if (!canBeCommander(c)) {
      warnings.push({
        id: `invalid-commander-${c.name}`,
        severity: 'error',
        title: `${c.name} non può essere un comandante`,
        detail: 'Serve una creatura leggendaria, o una carta che dice "can be your commander".',
        cards: [c.name],
      });
    }
  }

  if (a.commanders.length === 2) {
    const [x, y] = a.commanders;
    const background = (p: CardProfile) => /\bBackground\b/.test(frontTypeOf(p));
    const paired =
      (PAIRING.test(oracleOf(x)) && PAIRING.test(oracleOf(y))) ||
      (/Choose a Background/i.test(oracleOf(x)) && background(y)) ||
      (/Choose a Background/i.test(oracleOf(y)) && background(x));
    if (!paired) {
      warnings.push({
        id: 'partners',
        severity: 'error',
        title: 'Due comandanti sono ammessi solo con Partner, Friends forever o Background',
        cards: a.commanders.map((c) => c.name),
      });
    }
  } else if (a.commanders.length > 2) {
    warnings.push({ id: 'partners', severity: 'error', title: 'Al massimo due comandanti', cards: a.commanders.map((c) => c.name) });
  }

  const duplicates = a.profiles.filter((p) => p.quantity > 1 && !anyNumberAllowed(p));
  if (duplicates.length > 0) {
    warnings.push({
      id: 'singleton',
      severity: 'error',
      title: `Il Commander è singleton: ${duplicates.length === 1 ? 'una carta ha' : `${duplicates.length} carte hanno`} più di una copia`,
      cards: duplicates.map((p) => `${p.quantity} ${p.name}`),
    });
  }

  if (a.commanders.length > 0) {
    const identity = new Set<string>(a.commanderIdentity);
    const outside = a.profiles.filter((p) => p.card.color_identity.some((c) => !identity.has(c)));
    if (outside.length > 0) {
      const label = a.commanderIdentity.length > 0 ? a.commanderIdentity.map((c) => COLOR_NAMES[c]).join(', ') : 'incolore';
      warnings.push({
        id: 'color-identity',
        severity: 'error',
        title: `${outside.length === 1 ? 'Una carta è' : `${outside.length} carte sono`} fuori dall'identità di colore del comandante (${label})`,
        cards: outside.map((p) => p.name),
      });
    }
  }

  const banned = [...a.commanders, ...a.profiles].filter((p) => p.card.legalities?.commander === 'banned');
  if (banned.length > 0) {
    warnings.push({
      id: 'banned',
      severity: 'error',
      title: `${banned.length === 1 ? 'Una carta è bannata' : `${banned.length} carte sono bannate`} nel Commander`,
      cards: banned.map((p) => p.name),
    });
  }

  return warnings;
};

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

  if (a.format === 'commander') {
    warnings.push(...commanderWarnings(a));
  } else {
    warnings.push(...constructedWarnings(a));
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

  for (const alt of a.altOnly) {
    warnings.push({
      id: `alt-only-${alt.card}`,
      severity: 'info',
      title: `${alt.card} (${alt.manaCost}): non puoi lanciarla dalla mano`,
      detail: `Nessuna fonte di ${alt.missing.map(colorLabel).join(' e ')}, ma può entrare in gioco comunque: ${alt.alternatives.join('; ')}.`,
      cards: [alt.card],
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
      title: `${delta < 0 ? 'Poche' : 'Troppe'} terre: hai ${describeLands(a.lands)}, ne servono circa ${recommended.toFixed(1)}`,
      detail: [
        `Formula di Karsten con costo medio ${averageManaValue.toFixed(2)} e ${a.landCount.cheapDrawOrRamp.reduce((s, c) => s + c.quantity, 0)} pescate/ramp economici.`,
        (a.lands.landcyclers > 0 || a.lands.mdfc > 0) && 'Le fonti extra (landcycling e MDFC) contano come mezza terra.',
        a.landCount.excludedFromAverage.length > 0 &&
          `Escluse dal costo medio: ${a.landCount.excludedFromAverage.map((c) => c.name).join(', ')}.`,
        a.landCount.costReduced.length > 0 &&
          `Costo effettivo stimato per ${a.landCount.costReduced.map((c) => `${c.name} (${c.printed}→${c.effective}${c.via ? ` con ${c.via}` : ''})`).join(', ')}.`,
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
