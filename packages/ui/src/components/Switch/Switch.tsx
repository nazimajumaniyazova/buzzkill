import type { ComponentProps, JSX } from 'react';

import { cx } from '../../utils/cx';
import { useControlled } from '../../utils/use-controlled';
import styles from './Switch.module.css';

export interface SwitchProps extends Omit<
  ComponentProps<'button'>,
  'type' | 'onChange' | 'children' | 'value'
> {
  /** The visible label; it is the accessible name. */
  readonly label: string;
  /** The state when the parent controls it. */
  readonly checked?: boolean;
  /** The initial state when the switch holds it itself. */
  readonly defaultChecked?: boolean;
  /** Hears every change in both modes. */
  readonly onCheckedChange?: (checked: boolean) => void;
}

/**
 * An on/off control: a native button with `role="switch"` and `aria-checked`, so Space and
 * Enter toggle it and a form never submits it. The state is held here unless the parent passes
 * `checked`.
 */
export function Switch({
  label,
  checked,
  defaultChecked = false,
  onCheckedChange,
  className,
  onClick,
  ...rest
}: SwitchProps): JSX.Element {
  const [on, setOn] = useControlled(checked, defaultChecked, onCheckedChange);

  return (
    <button
      {...rest}
      type="button"
      role="switch"
      aria-checked={on}
      className={cx(styles.switch, className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          setOn(!on);
        }
      }}
    >
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      <span className={styles.label}>{label}</span>
    </button>
  );
}
