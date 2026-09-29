import { useNavigate, useParams } from 'react-router';
import { deleteDeck, useDeck } from '../store/decks';
import DeckView from '../components/deck/DeckView';
import ShareButton from '../components/deck/ShareButton';
import Button from '../components/ui/Button';
import { useConfirm } from '../components/ui/confirm';
import NotFoundPage from './NotFoundPage';

/** Mazzo salvato: vista del mazzo con condivisione ed eliminazione */
export default function DeckLayout() {
  const { id } = useParams();
  const deck = useDeck(id);
  const navigate = useNavigate();
  const confirm = useConfirm();

  if (!deck) return <NotFoundPage message="Questo mazzo non esiste più." />;

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Eliminare il mazzo?',
      message: `"${deck.name}" verrà eliminato definitivamente.`,
      confirmLabel: 'Elimina',
      danger: true,
    });
    if (ok) {
      deleteDeck(deck.id);
      navigate('/');
    }
  };

  return (
    <DeckView
      deck={deck}
      badge={deck.isTestDeck ? 'Mazzo di prova' : undefined}
      actions={
        <>
          <ShareButton deck={deck} />
          <Button size="sm" variant="danger" onClick={handleDelete}>
            Elimina
          </Button>
        </>
      }
    />
  );
}
