import type { ActionInput } from '../input/action-input';
import type { KeyBindings } from '../input/bindings';

/** The part of a `KeyboardEvent` the source reads. */
export interface KeyboardEventLike {
  readonly code: string;
  preventDefault(): void;
}

/** The part of `window` the keyboard source listens on, so tests can pass a fake. */
export interface KeyboardTarget {
  addEventListener(type: 'keydown' | 'keyup', listener: (event: KeyboardEventLike) => void): void;
  addEventListener(type: 'blur', listener: () => void): void;
  removeEventListener(
    type: 'keydown' | 'keyup',
    listener: (event: KeyboardEventLike) => void,
  ): void;
  removeEventListener(type: 'blur', listener: () => void): void;
}

export interface KeyboardSource<A extends string> {
  /** Replaces the bindings. Every key hold is released so that no action stays stuck. */
  setBindings(bindings: KeyBindings<A>): void;
  /** Removes the listeners and releases every key hold. */
  dispose(): void;
}

const SOURCE_PREFIX = 'key:';

/**
 * Feeds key presses into `input`. Bound keys get `preventDefault`, so arrows and Space do not
 * scroll the page; unbound keys pass through untouched. When the window loses focus the browser
 * never sends the matching `keyup`, so every key hold is released on `blur` instead of leaving
 * the hero running.
 */
export function createKeyboardSource<A extends string>(
  input: ActionInput<A>,
  bindings: KeyBindings<A>,
  target: KeyboardTarget = window,
): KeyboardSource<A> {
  let actionsByCode = indexBindings(bindings);

  const onKeyDown = (event: KeyboardEventLike): void => {
    const bound = actionsByCode.get(event.code);
    if (bound === undefined) {
      return;
    }
    event.preventDefault();
    for (const action of bound) {
      input.press(action, SOURCE_PREFIX + event.code);
    }
  };

  const onKeyUp = (event: KeyboardEventLike): void => {
    const bound = actionsByCode.get(event.code);
    if (bound === undefined) {
      return;
    }
    event.preventDefault();
    for (const action of bound) {
      input.release(action, SOURCE_PREFIX + event.code);
    }
  };

  const onBlur = (): void => {
    input.releaseSources(SOURCE_PREFIX);
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  return {
    setBindings(next) {
      input.releaseSources(SOURCE_PREFIX);
      actionsByCode = indexBindings(next);
    },
    dispose() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
      input.releaseSources(SOURCE_PREFIX);
    },
  };
}

/** Code to actions; one key may hold several actions if the bindings say so. */
function indexBindings<A extends string>(bindings: KeyBindings<A>): Map<string, A[]> {
  const index = new Map<string, A[]>();
  for (const action of Object.keys(bindings) as A[]) {
    for (const code of bindings[action]) {
      const list = index.get(code);
      if (list === undefined) {
        index.set(code, [action]);
      } else if (!list.includes(action)) {
        list.push(action);
      }
    }
  }
  return index;
}
