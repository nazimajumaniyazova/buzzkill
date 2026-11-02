/**
 * Clamps `value` into the inclusive range `[min, max]`.
 *
 * @throws RangeError when `min` is greater than `max`: silently swapping the bounds would
 *   hide a bug in the caller.
 */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new RangeError(`clamp: min (${String(min)}) must not exceed max (${String(max)})`);
  }
  if (value < min) {
    return min;
  }
  return value > max ? max : value;
}
