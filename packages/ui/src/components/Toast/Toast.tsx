import { type JSX, type KeyboardEvent, useEffect, useRef, useState } from 'react';

import { IconButton } from '../Button/IconButton';
import styles from './Toast.module.css';
import type { ToastOptions } from './toast-context';

export interface ToastProps extends ToastOptions {
  readonly id: number;
  /** The time on screen in milliseconds, or `null` for no timer. */
  readonly duration: number | null;
  readonly onDismiss: (id: number) => void;
}

/**
 * One notification. The timer pauses while the pointer is over it or focus is inside it, and
 * resumes with the time that was left; the dismiss button, and Escape on it, close it at once.
 */
export function Toast({
  id,
  title,
  description,
  tone = 'info',
  duration,
  dismissLabel = 'Dismiss',
  onDismiss,
}: ToastProps): JSX.Element {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(duration ?? 0);
  const startedAt = useRef(0);
  const itemRef = useRef<HTMLLIElement>(null);

  // Pointer over the toast or focus inside it pauses the timer. Listeners rather than JSX
  // handlers: the strict a11y lint rules reserve those for interactive elements.
  useEffect(() => {
    const item = itemRef.current;
    if (item === null) {
      return undefined;
    }
    const pause = (): void => {
      setPaused(true);
    };
    const resume = (): void => {
      setPaused(false);
    };
    item.addEventListener('pointerenter', pause);
    item.addEventListener('pointerleave', resume);
    item.addEventListener('focusin', pause);
    item.addEventListener('focusout', resume);
    return () => {
      item.removeEventListener('pointerenter', pause);
      item.removeEventListener('pointerleave', resume);
      item.removeEventListener('focusin', pause);
      item.removeEventListener('focusout', resume);
    };
  }, []);

  useEffect(() => {
    if (duration === null || paused) {
      return undefined;
    }
    startedAt.current = Date.now();
    const timer = setTimeout(() => {
      onDismiss(id);
    }, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };
  }, [duration, paused, id, onDismiss]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onDismiss(id);
    }
  };

  return (
    <li ref={itemRef} className={styles.toast} data-tone={tone}>
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        {description !== undefined && <p className={styles.description}>{description}</p>}
      </div>
      <IconButton
        size="sm"
        variant="secondary"
        label={dismissLabel}
        onClick={() => {
          onDismiss(id);
        }}
        onKeyDown={onKeyDown}
      >
        ✕
      </IconButton>
    </li>
  );
}
