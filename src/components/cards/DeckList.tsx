import { isPlaceholder, type DisplayCard } from '../../types';
import { TYPE_LABELS, type GroupedEntries } from '../../utils/deckSummary';
import ManaCost from '../ui/ManaCost';

interface DeckListProps {
  groups: GroupedEntries[];
  onHover?: (card: DisplayCard) => void;
  onSelect: (card: DisplayCard) => void;
}

/** Lista di carte raggruppata per tipo, in colonne */
export default function DeckList({ groups, onHover, onSelect }: DeckListProps) {
  return (
    <div className="columns-1 gap-6 sm:columns-2">
      {groups.map((group) => (
        <div key={group.type} className="mb-5 break-inside-avoid">
          <h3 className="mb-1.5 flex items-baseline justify-between border-b border-white/10 pb-1 text-xs font-semibold tracking-wider text-stone-400 uppercase">
            {TYPE_LABELS[group.type]}
            <span className="text-stone-500">{group.count}</span>
          </h3>
          <ul>
            {group.entries.map((entry) => (
              <li key={entry.name}>
                <button
                  className="group flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-white/5"
                  onMouseEnter={() => onHover?.(entry.card)}
                  onFocus={() => onHover?.(entry.card)}
                  onClick={() => onSelect(entry.card)}
                >
                  <span className="w-5 shrink-0 text-right font-semibold text-gold-300">{entry.quantity}</span>
                  <span
                    className={`min-w-0 flex-1 truncate ${isPlaceholder(entry.card) ? 'text-red-300' : 'text-stone-200 group-hover:text-white'}`}
                  >
                    {entry.name}
                  </span>
                  {!isPlaceholder(entry.card) && entry.card.mana_cost && (
                    <ManaCost cost={entry.card.mana_cost} size="sm" />
                  )}
                  {!isPlaceholder(entry.card) &&
                    !entry.card.mana_cost &&
                    entry.card.card_faces?.[0]?.mana_cost && (
                      <ManaCost cost={entry.card.card_faces[0].mana_cost} size="sm" />
                    )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
