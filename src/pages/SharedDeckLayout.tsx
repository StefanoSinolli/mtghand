import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { createDeck } from '../services/deckStorage';
import { saveDeck } from '../store/decks';
import { decodeDeck } from '../utils/shareCodec';
import DeckView from '../components/deck/DeckView';
import Button from '../components/ui/Button';
import NotFoundPage from './NotFoundPage';
import type { Deck } from '../types';

/** Mazzo aperto da un link: si può guardare, provare e analizzare, e salvare tra i propri */
export default function SharedDeckLayout() {
  const { payload = '' } = useParams();
  const navigate = useNavigate();
  const [deck, setDeck] = useState<Deck | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    decodeDeck(payload).then((shared) => {
      if (cancelled) return;
      if (!shared) {
        setDeck(null);
        return;
      }
      const now = new Date().toISOString();
      setDeck({
        ...shared,
        id: `shared-${payload.slice(0, 16)}`,
        schemaVersion: 2,
        createdAt: now,
        updatedAt: now,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  if (deck === undefined) return <p className="animate-pulse py-24 text-center text-stone-400">Apro il mazzo…</p>;
  if (deck === null) return <NotFoundPage message="Il link di condivisione non è valido o è incompleto." />;

  const handleSave = () => {
    const saved = createDeck(deck.name, deck.main, deck.side, deck.format, deck.commanders ?? []);
    saveDeck(saved);
    navigate(`/deck/${saved.id}`);
  };

  return (
    <DeckView
      deck={deck}
      editable={false}
      badge="Mazzo condiviso"
      actions={
        <Button size="sm" variant="primary" onClick={handleSave}>
          Salva nei miei mazzi
        </Button>
      }
    />
  );
}
