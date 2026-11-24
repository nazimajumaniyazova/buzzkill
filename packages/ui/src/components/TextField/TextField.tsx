import { type ComponentProps, type JSX, useId } from 'react';

import { cx } from '../../utils/cx';
import { useControlled } from '../../utils/use-controlled';
import styles from './TextField.module.css';

export interface TextFieldProps extends Omit<
  ComponentProps<'input'>,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'children'
> {
  /** The visible label; it is the accessible name. */
  readonly label: string;
  /** A hint under the label, such as the rules of the value; part of the accessible description. */
  readonly description?: string;
  /**
   * What is wrong with the value, in words. It marks the field invalid and joins the description,
   * so a screen reader reads it with the field; color only repeats it.
   */
  readonly error?: string;
  /** The value when the parent controls it. */
  readonly value?: string;
  /** The initial value when the field holds it itself; empty otherwise. */
  readonly defaultValue?: string;
  /** Hears every change in both modes. */
  readonly onValueChange?: (value: string) => void;
}

/**
 * A native text input with a label, a hint and an error. The browser gives it the textbox role,
 * editing and the keys. The value is held here unless the parent passes `value`.
 */
export function TextField({
  label,
  description,
  error,
  value,
  defaultValue = '',
  onValueChange,
  className,
  id,
  ...rest
}: TextFieldProps): JSX.Element {
  const [current, setCurrent] = useControlled(value, defaultValue, onValueChange);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;
  const errorId = `${inputId}-error`;
  const describedBy = [
    description === undefined ? null : descriptionId,
    error === undefined ? null : errorId,
  ]
    .filter((part) => part !== null)
    .join(' ');

  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      {description === undefined ? null : (
        <p id={descriptionId} className={styles.description}>
          {description}
        </p>
      )}
      <input
        {...rest}
        id={inputId}
        type="text"
        value={current}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        className={styles.input}
        onChange={(event) => {
          setCurrent(event.target.value);
        }}
      />
      {error === undefined ? null : (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
