import { useCallback, useState, type ReactNode } from 'react';
import Button from './Button';
import Modal from './Modal';
import { ConfirmContext, type ConfirmFn, type ConfirmOptions } from './confirm';

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (options) => new Promise<boolean>((resolve) => setState({ ...options, resolve })),
    [],
  );

  const close = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={state !== null} onClose={() => close(false)} className="w-full max-w-md p-6" label={state?.title}>
        {state && (
          <>
            <h2 className="pr-8 font-display text-xl font-bold text-gold-200">{state.title}</h2>
            {state.message && <div className="mt-3 text-sm text-stone-300">{state.message}</div>}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => close(false)}>
                Annulla
              </Button>
              <Button variant={state.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
                {state.confirmLabel ?? 'Conferma'}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}
