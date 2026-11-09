import { createContext } from 'react';

export type ToastTone = 'info' | 'success' | 'danger';

export interface ToastOptions {
  readonly title: string;
  readonly description?: string;
  /** `danger` is announced assertively; the others politely. */
  readonly tone?: ToastTone;
  /** Time on screen in milliseconds; `null` keeps the toast until it is dismissed. */
  readonly duration?: number | null;
  /** The accessible name of the dismiss button. */
  readonly dismissLabel?: string;
}

export interface ToastContextValue {
  /** Shows a toast and returns its id. */
  readonly show: (options: ToastOptions) => number;
  readonly dismiss: (id: number) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
