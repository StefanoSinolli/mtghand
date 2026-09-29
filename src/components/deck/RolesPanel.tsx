import { useMemo, useState } from 'react';
import { buildProfiles } from '../../analysis/analyze';
import { rolesOf } from '../../analysis/calculator';
import { useCardRoles } from '../../hooks/useCardRoles';
import { ROLES, type CardRole } from '../../services/roles';
import type { Deck, DisplayCard, ScryfallCard } from '../../types';
import Panel from '../ui/Panel';

interface RolesPanelProps {
  deck: Deck;
  cards: Map<string, ScryfallCard>;
  onHover: (card: DisplayCard) => void;
  onSelect: (card: DisplayCard) => void;
}

/** Riepilogo dei ruoli delle carte (ramp, pescate, rimozioni, tutor…) dalle etichette di Scryfall */
export default function RolesPanel({ deck, cards, onHover, onSelect }: RolesPanelProps) {
  const names = useMemo(() => deck.main.map((e) => e.name), [deck.main]);
  const tagged = useCardRoles(names);
  const [open, setOpen] = useState<CardRole | null>(null);

  const byRole = useMemo(() => {
    const { profiles } = buildProfiles(deck, cards);
    return ROLES.map((role) => {
      const members = profiles.filter((p) => rolesOf(p, tagged.roles).includes(role.id));
      return { ...role, members, count: members.reduce((s, p) => s + p.quantity, 0) };
    });
  }, [deck, cards, tagged.roles]);

  const selected = byRole.find((r) => r.id === open);

  return (
    <Panel
      title="Ruoli"
      subtitle={
        tagged.loading
          ? 'Classifico le carte con le etichette di Scryfall…'
          : tagged.error
            ? 'Etichette di Scryfall non disponibili: ruoli riconosciuti solo dal testo'
            : 'Dalle etichette della community di Scryfall (Tagger)'
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {byRole.map((role) => (
          <button
            key={role.id}
            onClick={() => setOpen(open === role.id ? null : role.id)}
            aria-expanded={open === role.id}
            disabled={role.count === 0}
            className={`cursor-pointer rounded-xl px-3 py-2 text-left transition-colors disabled:cursor-default disabled:opacity-40 ${
              open === role.id ? 'bg-gold-400/20 ring-1 ring-gold-400/60' : 'bg-black/25 hover:bg-white/5'
            }`}
          >
            <span className={`block text-2xl font-bold tabular-nums ${tagged.loading ? 'animate-pulse text-stone-500' : 'text-stone-50'}`}>
              {role.count}
            </span>
            <span className="text-xs text-stone-400">{role.label}</span>
          </button>
        ))}
      </div>

      {selected && selected.members.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {selected.members.map((p) => (
            <li key={p.name}>
              <button
                className="cursor-pointer rounded-full bg-black/30 px-2.5 py-1 text-xs text-stone-200 hover:bg-white/10"
                onMouseEnter={() => onHover(p.card)}
                onClick={() => onSelect(p.card)}
              >
                {p.quantity > 1 && `${p.quantity} `}
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
