import { createContext, useContext, type ReactNode } from 'react';

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmFn>(async () => false);

/** Dialog di conferma asincrono: `if (await confirm({ title })) …` */
export const useConfirm = () => useContext(ConfirmContext);
