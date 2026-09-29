import { useEffect, useState } from 'react';
import { fetchRoles, type CardRole } from '../services/roles';

/**
 * Ruoli delle carte dalle etichette di Scryfall (chiave: nome normalizzato).
 * La prima volta servono alcune ricerche; poi i risultati sono in cache.
 */
export const useCardRoles = (names: string[] | null) => {
  const [state, setState] = useState<{ roles: Map<string, CardRole[]>; loading: boolean; error: boolean }>({
    roles: new Map(),
    loading: names !== null && names.length > 0,
    error: false,
  });
  const key = names ? [...new Set(names)].sort().join('\n') : null;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: false }));
    fetchRoles(key.split('\n'))
      .then((roles) => !cancelled && setState({ roles, loading: false, error: false }))
      .catch((error: unknown) => {
        console.error('Ruoli delle carte non disponibili', error);
        if (!cancelled) setState((prev) => ({ ...prev, loading: false, error: true }));
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return state;
};
