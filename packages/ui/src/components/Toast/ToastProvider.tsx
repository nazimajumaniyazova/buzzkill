import { type JSX, type ReactNode, useCallback, useMemo, useRef, useState } from 'react';

import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden';
import { Toast } from './Toast';
import {
  ToastContext,
  type ToastContextValue,
  type ToastOptions,
  type ToastTone,
} from './toast-context';
import styles from './ToastProvider.module.css';

export interface ToastProviderProps {
  /** The accessible name of the notification region. */
  readonly label?: string;
  /** The time on screen a toast gets unless it says otherwise; `null` keeps toasts until dismissed. */
  readonly duration?: number | null;
  readonly children: ReactNode;
}

interface ToastEntry extends ToastOptions {
  readonly id: number;
}

interface Announcement {
  readonly tone: ToastTone;
  readonly text: string;
}

/**
 * Holds the toasts and renders them in a region at the corner of the viewport. A toast never
 * takes focus: its text goes into a live region that exists from the start, politely, or
 * assertively for `danger`, so assistive technology announces it where the user is. Use
 * `useToast` below the provider to show one.
 */
export function ToastProvider({
  label = 'Notifications',
  duration = 5000,
  children,
}: ToastProviderProps): JSX.Element {
  const [toasts, setToasts] = useState<readonly ToastEntry[]>([]);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((options: ToastOptions): number => {
    const id = nextId.current;
    nextId.current += 1;
    setToasts((list) => [...list, { ...options, id }]);
    setAnnouncement({
      tone: options.tone ?? 'info',
      text: [options.title, options.description].filter(Boolean).join('. '),
    });
    return id;
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext value={value}>
      {children}
      <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
        {announcement !== null && announcement.tone !== 'danger' ? announcement.text : null}
      </VisuallyHidden>
      <VisuallyHidden role="alert" aria-atomic="true">
        {announcement !== null && announcement.tone === 'danger' ? announcement.text : null}
      </VisuallyHidden>
      <ol className={styles.region} aria-label={label}>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            {...toast}
            duration={toast.duration === undefined ? duration : toast.duration}
            onDismiss={dismiss}
          />
        ))}
      </ol>
    </ToastContext>
  );
}
