import { createActionInput, type GamepadBindings } from '@buzzkill/engine';
import { createGamepadSource, type GamepadLike } from '@buzzkill/engine/browser';

const MENU_ACTIONS = ['up', 'down', 'left', 'right', 'confirm', 'back'] as const;

type MenuAction = (typeof MENU_ACTIONS)[number];

/** The W3C standard mapping: the D-pad is 12 to 15, the left stick axes 0 and 1, A is 0, B is 1. */
const MENU_GAMEPAD_BINDINGS = {
  buttons: { up: [12], down: [13], left: [14], right: [15], confirm: [0], back: [1] },
  axes: {
    up: [{ axis: 1, direction: -1 }],
    down: [{ axis: 1, direction: 1 }],
    left: [{ axis: 0, direction: -1 }],
    right: [{ axis: 0, direction: 1 }],
  },
} as const satisfies GamepadBindings<MenuAction>;

export interface GamepadNavigationOptions {
  /** Where focus moves: the screen on display, or the open dialog over it. */
  readonly root: () => HTMLElement | null;
  /** What the B button does: the Back of the screen or the close of the dialog. */
  readonly onBack?: () => void;
  /** Defaults to `navigator.getGamepads()`. */
  readonly getGamepads?: () => readonly (GamepadLike | null)[];
  /** Defaults to `requestAnimationFrame`. */
  readonly requestFrame?: (callback: () => void) => number;
  readonly cancelFrame?: (handle: number) => void;
}

export interface GamepadNavigation {
  /** Reads the pads once and acts on what was pressed since the last read. */
  poll(): void;
  /** Stops polling and releases the pads. */
  dispose(): void;
}

const TABBABLE = 'a[href], button, input, select, textarea, [tabindex]';

/**
 * Lets a gamepad use the menus and the dialogs the way the keyboard does: the D-pad and the left
 * stick move focus between the controls Tab visits and, left and right, pick the next radio, nudge
 * a slider, switch a tab or flip a switch; A activates the focused control; B goes back. It polls
 * once per frame, like the game's own gamepad source, since the Gamepad API has no button events.
 */
export function createGamepadNavigation(options: GamepadNavigationOptions): GamepadNavigation {
  const input = createActionInput(MENU_ACTIONS);
  const source = createGamepadSource(input, {
    bindings: MENU_GAMEPAD_BINDINGS,
    ...(options.getGamepads === undefined ? {} : { getGamepads: options.getGamepads }),
  });
  const requestFrame = options.requestFrame ?? ((callback) => requestAnimationFrame(callback));
  const cancelFrame =
    options.cancelFrame ??
    ((handle) => {
      cancelAnimationFrame(handle);
    });
  const bit = {
    up: input.bit('up'),
    down: input.bit('down'),
    left: input.bit('left'),
    right: input.bit('right'),
    confirm: input.bit('confirm'),
    back: input.bit('back'),
  };
  let handle: number | null = null;

  const poll = (): void => {
    source.poll();
    const { pressed } = input.sample();
    if (pressed === 0) {
      return;
    }
    const root = options.root();
    if (root === null) {
      return;
    }
    if ((pressed & bit.up) !== 0) {
      moveFocus(root, -1);
    }
    if ((pressed & bit.down) !== 0) {
      moveFocus(root, 1);
    }
    if ((pressed & bit.left) !== 0) {
      adjust(root, -1);
    }
    if ((pressed & bit.right) !== 0) {
      adjust(root, 1);
    }
    if ((pressed & bit.confirm) !== 0) {
      focused(root)?.click();
    }
    if ((pressed & bit.back) !== 0) {
      options.onBack?.();
    }
  };

  const frame = (): void => {
    poll();
    handle = requestFrame(frame);
  };
  handle = requestFrame(frame);

  return {
    poll,
    dispose() {
      if (handle !== null) {
        cancelFrame(handle);
        handle = null;
      }
      source.dispose();
    },
  };
}

function isDisabled(element: Element): boolean {
  return (
    (element instanceof HTMLButtonElement ||
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement) &&
    element.disabled
  );
}

/** The enabled radios of the group `radio` belongs to, in document order. */
function radiosOf(root: HTMLElement, radio: HTMLInputElement): HTMLInputElement[] {
  return [...root.querySelectorAll<HTMLInputElement>('input[type="radio"]')].filter(
    (other) => other.name === radio.name && !other.disabled,
  );
}

/**
 * The controls Tab visits inside `root`, in order. Like the browser, a radio group counts once,
 * through its checked radio; roving tab indices of -1 (the inactive tabs) are skipped.
 */
function tabStops(root: HTMLElement): HTMLElement[] {
  const groups = new Set<string>();
  const result: HTMLElement[] = [];
  for (const element of root.querySelectorAll<HTMLElement>(TABBABLE)) {
    if (element.tabIndex < 0 || isDisabled(element) || element.closest('[hidden]') !== null) {
      continue;
    }
    if (element instanceof HTMLInputElement && element.type === 'radio') {
      if (groups.has(element.name)) {
        continue;
      }
      groups.add(element.name);
      result.push(radiosOf(root, element).find((radio) => radio.checked) ?? element);
      continue;
    }
    result.push(element);
  }
  return result;
}

/** The focused element when it is inside `root`. */
function focused(root: HTMLElement): HTMLElement | null {
  const active = document.activeElement;
  return active instanceof HTMLElement && root.contains(active) ? active : null;
}

function moveFocus(root: HTMLElement, delta: 1 | -1): void {
  const list = tabStops(root);
  if (list.length === 0) {
    return;
  }
  const current = focused(root);
  const index = current === null ? -1 : list.indexOf(current);
  const next =
    index === -1 ? (delta > 0 ? 0 : list.length - 1) : (index + delta + list.length) % list.length;
  list[next]?.focus();
}

/** Left and right on the focused control, as the arrow keys would act on it. */
function adjust(root: HTMLElement, delta: 1 | -1): void {
  const active = focused(root);
  if (active === null) {
    return;
  }
  if (active instanceof HTMLInputElement && active.type === 'radio') {
    const radios = radiosOf(root, active);
    const next = radios[(radios.indexOf(active) + delta + radios.length) % radios.length];
    next?.focus();
    next?.click();
    return;
  }
  if (active instanceof HTMLInputElement && active.type === 'range') {
    nudge(active, delta);
    return;
  }
  const role = active.getAttribute('role');
  if (role === 'tab') {
    const list = active.closest('[role="tablist"]');
    const tabs =
      list === null
        ? []
        : [...list.querySelectorAll<HTMLElement>('[role="tab"]')].filter((tab) => !isDisabled(tab));
    const next = tabs[(tabs.indexOf(active) + delta + tabs.length) % tabs.length];
    next?.click();
    next?.focus();
    return;
  }
  if (role === 'switch') {
    const on = active.getAttribute('aria-checked') === 'true';
    if (on !== delta > 0) {
      active.click();
    }
  }
}

/** One step along a range input, within its bounds, through the event React listens to. */
function nudge(range: HTMLInputElement, delta: 1 | -1): void {
  const step = Number(range.step) || 1;
  const min = range.min === '' ? 0 : Number(range.min);
  const max = range.max === '' ? 100 : Number(range.max);
  const decimals = (String(step).split('.')[1] ?? '').length;
  const current = Number(range.value);
  const value = Math.min(max, Math.max(min, Number((current + delta * step).toFixed(decimals))));
  if (value === current) {
    return;
  }
  // React tracks the value it last set; the prototype's setter bypasses that tracker, so the
  // following input event reaches the component's onChange.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
    range,
    String(value),
  );
  range.dispatchEvent(new Event('input', { bubbles: true }));
}
