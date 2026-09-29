import { useState } from 'react';
import { encodeDeck, shareUrl } from '../../utils/shareCodec';
import type { Deck } from '../../types';
import Button from '../ui/Button';

/** Condivide il mazzo: menu di condivisione su mobile, altrimenti copia il link */
export default function ShareButton({ deck }: { deck: Deck }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');

  const handleShare = async () => {
    try {
      const url = shareUrl(await encodeDeck(deck));
      const touch = window.matchMedia('(pointer: coarse)').matches;
      if (touch && navigator.share) {
        await navigator.share({ title: deck.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch (error) {
      // l'utente ha chiuso il menu di condivisione: nessun errore da mostrare
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setState('error');
    }
    setTimeout(() => setState('idle'), 2500);
  };

  return (
    <Button size="sm" variant="primary" onClick={handleShare}>
      {state === 'copied' ? '✓ Link copiato' : state === 'error' ? 'Errore, riprova' : 'Condividi'}
    </Button>
  );
}
