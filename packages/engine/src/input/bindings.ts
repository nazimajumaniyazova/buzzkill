/**
 * Device bindings as plain data. They live in the headless core so the game can define and
 * validate its defaults without the DOM; the sources that read devices are in `../browser`.
 */

/**
 * Keyboard bindings: for each action, the `KeyboardEvent.code` values that hold it. Codes name
 * physical keys (`KeyW` is the key left of `E` on any layout), so WASD works on AZERTY too.
 */
export type KeyBindings<A extends string> = Readonly<Record<A, readonly string[]>>;

/** A stick direction: the axis index and which way counts, -1 for up or left, 1 for down or right. */
export interface AxisBinding {
  readonly axis: number;
  readonly direction: -1 | 1;
}

/**
 * Gamepad bindings by the indices of the W3C standard mapping: button 0 is the bottom face
 * button, 9 is Start, 12 to 15 are the D-pad; axis 1 is the left stick's vertical.
 */
export interface GamepadBindings<A extends string> {
  readonly buttons?: Readonly<Partial<Record<A, readonly number[]>>>;
  readonly axes?: Readonly<Partial<Record<A, readonly AxisBinding[]>>>;
}

/**
 * Binds `code` to `action` in place of the key at position `slot` (or appends it when the action
 * has fewer keys), and removes `code` from every other action so one key never holds two
 * actions by accident. Returns new bindings; the input is not modified.
 */
export function rebindKey<A extends string>(
  bindings: KeyBindings<A>,
  // The action set comes from the bindings, not from the action argument.
  action: NoInfer<A>,
  code: string,
  slot = 0,
): KeyBindings<A> {
  if (!Number.isInteger(slot) || slot < 0) {
    throw new RangeError(`rebindKey: slot must be an integer >= 0, got ${String(slot)}`);
  }
  const next = {} as Record<A, readonly string[]>;
  for (const key of Object.keys(bindings) as A[]) {
    next[key] = bindings[key].filter((bound) => bound !== code);
  }
  const own = [...bindings[action]];
  if (slot < own.length) {
    own[slot] = code;
  } else {
    own.push(code);
  }
  // Remove a second copy of `code` that the replacement may have left behind.
  next[action] = own.filter((bound, index) => bound !== code || index === own.indexOf(code));
  return next;
}
