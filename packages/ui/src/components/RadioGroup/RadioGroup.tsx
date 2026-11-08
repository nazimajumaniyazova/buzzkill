import type { JSX } from 'react';

import { cx } from '../../utils/cx';
import { useControlled } from '../../utils/use-controlled';
import styles from './RadioGroup.module.css';

export interface RadioOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface RadioGroupProps<T extends string> {
  /** The question the options answer; the legend of the group. */
  readonly label: string;
  /** Shared by the radios, so the browser moves between them with the arrow keys. */
  readonly name: string;
  readonly options: readonly RadioOption<T>[];
  /** The choice when the parent controls it. */
  readonly value?: T;
  /** The initial choice when the group holds it itself; none otherwise. */
  readonly defaultValue?: T;
  /** Hears every change in both modes. */
  readonly onValueChange?: (value: T) => void;
  readonly orientation?: 'horizontal' | 'vertical';
  readonly className?: string;
}

/**
 * One choice out of a few, as native radios in a `fieldset`: Tab reaches the checked option,
 * the arrow keys move and choose within the group, and the legend names it. The state is held
 * here unless the parent passes `value`.
 */
export function RadioGroup<T extends string>({
  label,
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  orientation = 'horizontal',
  className,
}: RadioGroupProps<T>): JSX.Element {
  const [current, setCurrent] = useControlled<T | null>(value, defaultValue ?? null, (next) => {
    if (next !== null) {
      onValueChange?.(next);
    }
  });

  return (
    <fieldset className={cx(styles.group, className)} data-orientation={orientation}>
      <legend className={styles.legend}>{label}</legend>
      <div className={styles.options}>
        {options.map((option) => (
          <label key={option.value} className={styles.option}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={current === option.value}
              disabled={option.disabled}
              className={styles.input}
              onChange={() => {
                setCurrent(option.value);
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
