import { useCallback, useState } from 'react';

/**
 * State that a component holds itself unless the parent controls it: `controlled` wins when it
 * is given, `defaultValue` seeds the inner state otherwise, and `onChange` hears every change in
 * both modes.
 */
export function useControlled<T>(
  controlled: T | undefined,
  defaultValue: T,
  onChange?: (value: T) => void,
): readonly [T, (value: T) => void] {
  const [inner, setInner] = useState(defaultValue);
  const isControlled = controlled !== undefined;
  const value = isControlled ? controlled : inner;

  const set = useCallback(
    (next: T) => {
      if (!isControlled) {
        setInner(next);
      }
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  return [value, set];
}
