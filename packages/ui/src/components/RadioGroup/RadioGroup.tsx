import { type JSX, useId } from 'react';

import { cx } from '../../utils/cx';
import { useControlled } from '../../utils/use-controlled';
import styles from './RadioGroup.module.css';

export interface RadioOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly disabled?: boolean;
  /**
   * What the option needs or means, under its label: why a disabled option is not there yet. The
   * radio's description, so a screen reader reads it after the name.
   */
  readonly description?: string;
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
 * here unless the parent passes `value`. An option's description sits under its label, outside
 * it, so the radio keeps a short name.
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
  const descriptionId = useId();
  const [current, setCurrent] = useControlled<T | null>(value, defaultValue ?? null, (next) => {
    if (next !== null) {
      onValueChange?.(next);
    }
  });

  return (
    <fieldset className={cx(styles.group, className)} data-orientation={orientation}>
      <legend className={styles.legend}>{label}</legend>
      <div className={styles.options}>
        {options.map((option) => {
          const described = `${descriptionId}-${option.value}`;
          return (
            <div key={option.value} className={styles.item}>
              <label className={styles.option}>
                <input
                  type="radio"
                  name={name}
                  value={option.value}
                  checked={current === option.value}
                  disabled={option.disabled}
                  aria-describedby={option.description === undefined ? undefined : described}
                  className={styles.input}
                  onChange={() => {
                    setCurrent(option.value);
                  }}
                />
                {option.label}
              </label>
              {option.description !== undefined && (
                <p id={described} className={styles.description}>
                  {option.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
