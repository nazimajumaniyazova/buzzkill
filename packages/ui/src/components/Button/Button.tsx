import type { ComponentProps, JSX } from 'react';

import { cx } from '../../utils/cx';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ComponentProps<'button'>, 'type'> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  /**
   * Shows a spinner and ignores activation while the button stays focusable and keeps its
   * label, so focus is not lost mid-action; `aria-busy` and `aria-disabled` say why.
   */
  readonly loading?: boolean;
  /** `button` unless said otherwise, so a button inside a form does not submit it by accident. */
  readonly type?: 'button' | 'submit' | 'reset';
}

/**
 * The action button: three variants and three sizes from the `button` component tokens, the
 * disabled and loading states, a visible focus ring in both themes. A native `button`, so Enter
 * and Space activate it and `type="submit"` submits a form.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  type = 'button',
  className,
  onClick,
  children,
  ...rest
}: ButtonProps): JSX.Element {
  return (
    <button
      {...rest}
      type={type}
      className={cx(styles.button, className)}
      data-variant={variant}
      data-size={size}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={loading ? undefined : onClick}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      <span className={styles.label}>{children}</span>
    </button>
  );
}
