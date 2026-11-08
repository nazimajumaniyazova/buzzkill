import type { JSX } from 'react';

import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden';
import styles from './KeyHint.module.css';

export type KeyHintKind = 'key' | 'gamepad';

export interface KeyHintProps {
  /** The accessible name of the key or button: "Space", "Arrow up", "Button A". */
  readonly children: string;
  /** What is printed on the cap when it differs from the name: "↑" for "Arrow up". */
  readonly symbol?: string;
  /** A keyboard key cap or a round gamepad button. */
  readonly kind?: KeyHintKind;
}

/**
 * A key or a gamepad button in the controls help. The name is always available to assistive
 * technology: when a symbol is printed instead, the name stays as visually hidden text.
 */
export function KeyHint({ children, symbol, kind = 'key' }: KeyHintProps): JSX.Element {
  return (
    <kbd className={styles.keyHint} data-kind={kind}>
      {symbol === undefined ? (
        children
      ) : (
        <>
          <span aria-hidden="true">{symbol}</span>
          <VisuallyHidden>{children}</VisuallyHidden>
        </>
      )}
    </kbd>
  );
}
