import { useContext } from 'react';

import { ToastContext, type ToastContextValue } from './toast-context';

/** The toast API of the nearest `ToastProvider`. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) {
    throw new Error('useToast needs a ToastProvider above it');
  }
  return context;
}
