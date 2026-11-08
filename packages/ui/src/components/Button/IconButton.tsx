import type { JSX, ReactNode } from 'react';

import { cx } from '../../utils/cx';
import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden';
import { Button, type ButtonProps } from './Button';
import styles from './IconButton.module.css';

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'title'> {
  /** The accessible name, required: the text a screen reader says and the tooltip. */
  readonly label: string;
  /** The icon. It is decorative; the label carries the meaning. */
  readonly children: ReactNode;
}

/**
 * A square `Button` with an icon only. The label is required, so the button can never ship
 * without a name; it is the tooltip and the visually hidden text next to the icon.
 */
export function IconButton({ label, children, className, ...rest }: IconButtonProps): JSX.Element {
  return (
    <Button {...rest} className={cx(styles.iconButton, className)} title={label}>
      <span className={styles.icon} aria-hidden="true">
        {children}
      </span>
      <VisuallyHidden>{label}</VisuallyHidden>
    </Button>
  );
}
