import { type ComponentProps, type JSX, useId } from 'react';

import { cx } from '../../utils/cx';
import { useControlled } from '../../utils/use-controlled';
import styles from './Slider.module.css';

export interface SliderProps extends Omit<
  ComponentProps<'input'>,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max' | 'step' | 'children'
> {
  /** The visible label; it is the accessible name. */
  readonly label: string;
  /** The value when the parent controls it. */
  readonly value?: number;
  /** The initial value when the slider holds it itself; `min` otherwise. */
  readonly defaultValue?: number;
  /** Hears every change in both modes. */
  readonly onValueChange?: (value: number) => void;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  /**
   * The value as people hear and read it: `30 %` rather than `0.3`. It is the `aria-valuetext`
   * and the readout next to the track.
   */
  readonly formatValue?: (value: number) => string;
}

/**
 * A native range input with a label and a readout. The browser gives it the slider role and
 * the keys: arrows step, Home and End jump, Page Up and Page Down leap. The state is held here
 * unless the parent passes `value`.
 */
export function Slider({
  label,
  value,
  defaultValue,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  formatValue = String,
  className,
  id,
  ...rest
}: SliderProps): JSX.Element {
  const [current, setCurrent] = useControlled(value, defaultValue ?? min, onValueChange);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const text = formatValue(current);

  return (
    <div className={cx(styles.slider, className)}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <div className={styles.row}>
        <input
          {...rest}
          id={inputId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={current}
          aria-valuetext={text}
          className={styles.input}
          onChange={(event) => {
            setCurrent(Number(event.target.value));
          }}
        />
        {/* The readout repeats `aria-valuetext` for sighted users; hidden from the rest. */}
        <output htmlFor={inputId} className={styles.value} aria-hidden="true">
          {text}
        </output>
      </div>
    </div>
  );
}
