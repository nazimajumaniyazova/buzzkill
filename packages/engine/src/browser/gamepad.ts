import type { ActionInput } from '../input/action-input';
import type { GamepadBindings } from '../input/bindings';

/** The part of a `Gamepad` the source reads. */
export interface GamepadLike {
  readonly index: number;
  readonly connected: boolean;
  readonly buttons: readonly { readonly pressed: boolean }[];
  readonly axes: readonly number[];
}

export interface GamepadSourceOptions<A extends string> {
  readonly bindings: GamepadBindings<A>;
  /** Defaults to `navigator.getGamepads()`. */
  readonly getGamepads?: () => readonly (GamepadLike | null)[];
  /** How far a stick must move, in (0, 1], before its direction counts. Default 0.5. */
  readonly deadzone?: number;
}

export interface GamepadSource<A extends string> {
  /**
   * Reads every connected gamepad and updates the holds. The Gamepad API has no events for
   * buttons, so call this once per frame, before the simulation samples the input.
   */
  poll(): void;
  /** Replaces the bindings and releases every gamepad hold. */
  setBindings(bindings: GamepadBindings<A>): void;
  /** Releases every gamepad hold. */
  dispose(): void;
}

const SOURCE_PREFIX = 'pad:';
// Numeric control keys for the id cache: buttons below 512, stick directions from 512 up.
const AXIS_KEY_BASE = 512;
const CONTROLS_PER_PAD = 1024;

interface CompiledControl<A extends string> {
  readonly action: A;
  /** Button index, or the axis index for a stick direction. */
  readonly index: number;
  /** 0 for a button, -1 or 1 for a stick direction. */
  readonly direction: -1 | 0 | 1;
}

/** Flattens the bindings once, so polling walks an array instead of object keys. */
function compile<A extends string>(bindings: GamepadBindings<A>): CompiledControl<A>[] {
  const controls: CompiledControl<A>[] = [];
  const { buttons, axes } = bindings;
  if (buttons !== undefined) {
    for (const action of Object.keys(buttons) as A[]) {
      for (const index of buttons[action] ?? []) {
        controls.push({ action, index, direction: 0 });
      }
    }
  }
  if (axes !== undefined) {
    for (const action of Object.keys(axes) as A[]) {
      for (const { axis, direction } of axes[action] ?? []) {
        controls.push({ action, index: axis, direction });
      }
    }
  }
  return controls;
}

/** Feeds gamepad buttons and stick directions into `input` by polling. */
export function createGamepadSource<A extends string>(
  input: ActionInput<A>,
  options: GamepadSourceOptions<A>,
): GamepadSource<A> {
  const deadzone = options.deadzone ?? 0.5;
  if (!(deadzone > 0 && deadzone <= 1)) {
    throw new RangeError(
      `createGamepadSource: deadzone must be in (0, 1], got ${String(deadzone)}`,
    );
  }
  const getGamepads = options.getGamepads ?? (() => navigator.getGamepads());
  let controls = compile(options.bindings);
  // Pads seen in the previous poll and in the current one; swapped instead of reallocated.
  let known = new Set<number>();
  let seen = new Set<number>();
  // Source ids are built once per control and reused, so polling does not allocate strings.
  const ids = new Map<number, string>();

  const idFor = (pad: number, control: CompiledControl<A>): string => {
    const local =
      control.direction === 0
        ? control.index
        : AXIS_KEY_BASE + control.index * 2 + (control.direction < 0 ? 0 : 1);
    const key = pad * CONTROLS_PER_PAD + local;
    let id = ids.get(key);
    if (id === undefined) {
      const name =
        control.direction === 0
          ? `b${String(control.index)}`
          : `a${String(control.index)}${control.direction < 0 ? '-' : '+'}`;
      id = `${SOURCE_PREFIX}${String(pad)}:${name}`;
      ids.set(key, id);
    }
    return id;
  };

  const isHeld = (pad: GamepadLike, control: CompiledControl<A>): boolean => {
    if (control.direction === 0) {
      return pad.buttons[control.index]?.pressed ?? false;
    }
    const value = pad.axes[control.index] ?? 0;
    return value * control.direction >= deadzone;
  };

  return {
    poll() {
      seen.clear();
      for (const pad of getGamepads()) {
        if (!pad?.connected) {
          continue;
        }
        seen.add(pad.index);
        for (const control of controls) {
          const source = idFor(pad.index, control);
          if (isHeld(pad, control)) {
            input.press(control.action, source);
          } else {
            input.release(control.action, source);
          }
        }
      }
      // A pad that disappeared sends no more updates: release whatever it was holding.
      for (const index of known) {
        if (!seen.has(index)) {
          input.releaseSources(`${SOURCE_PREFIX}${String(index)}:`);
        }
      }
      const previous = known;
      known = seen;
      seen = previous;
    },
    setBindings(next) {
      input.releaseSources(SOURCE_PREFIX);
      controls = compile(next);
    },
    dispose() {
      input.releaseSources(SOURCE_PREFIX);
      known.clear();
    },
  };
}
