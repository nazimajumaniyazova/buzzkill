import type { GamepadLike } from '@buzzkill/engine/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createGamepadNavigation } from './gamepad-navigation';

/** A mutable pad in the shape of the standard mapping: 17 buttons, 4 axes. */
function createPad() {
  const pad = {
    index: 0,
    connected: true,
    buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
    axes: [0, 0, 0, 0],
  };
  return {
    pad,
    press: (button: number, pressed = true): void => {
      const control = pad.buttons[button];
      if (control !== undefined) {
        control.pressed = pressed;
      }
    },
    stick: (axis: number, value: number): void => {
      pad.axes[axis] = value;
    },
  };
}

/** A screen with one of every control the menus use, and a few things Tab must skip. */
function createScreen() {
  document.body.replaceChildren(
    document.createRange().createContextualFragment(`
    <div id="root">
      <button id="play">Play</button>
      <button id="settings">Settings</button>
      <button id="disabled" disabled>Disabled</button>
      <fieldset>
        <label><input type="radio" name="hero" value="male" checked /> Mike</label>
        <label><input type="radio" name="hero" value="female" /> Julie</label>
      </fieldset>
      <input id="volume" type="range" min="0" max="1" step="0.1" value="0.3" />
      <div role="tablist">
        <button id="tab-sound" role="tab" aria-selected="true" tabindex="0">Sound</button>
        <button id="tab-display" role="tab" aria-selected="false" tabindex="-1">Display</button>
      </div>
      <button id="switch" role="switch" aria-checked="false">Sound</button>
      <div hidden><button id="hidden">Hidden</button></div>
    </div>
    <button id="outside">Outside</button>
  `),
  );
  const root = document.getElementById('root');
  if (root === null) {
    throw new Error('no root');
  }
  const byId = (id: string): HTMLElement => {
    const element = document.getElementById(id);
    if (element === null) {
      throw new Error(`no #${id}`);
    }
    return element;
  };
  // The tabs and the switch behave like the components: a click selects or flips.
  for (const tab of root.querySelectorAll<HTMLElement>('[role="tab"]')) {
    tab.addEventListener('click', () => {
      for (const other of root.querySelectorAll<HTMLElement>('[role="tab"]')) {
        const selected = other === tab;
        other.setAttribute('aria-selected', String(selected));
        other.tabIndex = selected ? 0 : -1;
      }
    });
  }
  const toggle = byId('switch');
  toggle.addEventListener('click', () => {
    toggle.setAttribute('aria-checked', String(toggle.getAttribute('aria-checked') !== 'true'));
  });
  return { root, byId };
}

function setup(root: HTMLElement | null, onBack = vi.fn()) {
  const { pad, press, stick } = createPad();
  const pads: (GamepadLike | null)[] = [pad];
  const requestFrame = vi.fn<(callback: () => void) => number>(() => 1);
  const cancelFrame = vi.fn();
  const navigation = createGamepadNavigation({
    root: () => root,
    onBack,
    getGamepads: () => pads,
    requestFrame,
    cancelFrame,
  });
  /** Taps a button: pressed on one poll, released on the next. */
  const tap = (button: number): void => {
    press(button);
    navigation.poll();
    press(button, false);
    navigation.poll();
  };
  return { navigation, press, stick, tap, onBack, requestFrame, cancelFrame };
}

const focusedId = (): string | null => document.activeElement?.id ?? null;

describe('createGamepadNavigation', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('moves focus down and up through the controls Tab visits, wrapping around', () => {
    const { root } = createScreen();
    const { tap } = setup(root);

    tap(13);
    expect(focusedId()).toBe('play');
    tap(13);
    expect(focusedId()).toBe('settings');
    tap(13);
    expect(document.activeElement).toHaveProperty('value', 'male');
    tap(13);
    expect(focusedId()).toBe('volume');
    tap(13);
    expect(focusedId()).toBe('tab-sound');
    tap(13);
    expect(focusedId()).toBe('switch');
    tap(13);
    expect(focusedId()).toBe('play');

    tap(12);
    expect(focusedId()).toBe('switch');
  });

  it('reads the left stick as the D-pad, once per push', () => {
    const { root } = createScreen();
    const { navigation, stick } = setup(root);

    stick(1, 1);
    navigation.poll();
    navigation.poll();
    stick(1, 0);
    navigation.poll();

    expect(focusedId()).toBe('play');
  });

  it('activates the focused control with A', () => {
    const { root, byId } = createScreen();
    const onClick = vi.fn();
    byId('settings').addEventListener('click', onClick);
    const { tap } = setup(root);
    byId('settings').focus();

    tap(0);

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('picks the next radio of the group with left and right', () => {
    const { root } = createScreen();
    const { tap } = setup(root);
    root.querySelector<HTMLInputElement>('input[value="male"]')?.focus();

    tap(15);
    expect(root.querySelector<HTMLInputElement>('input[value="female"]')?.checked).toBe(true);
    expect(document.activeElement).toHaveProperty('value', 'female');

    tap(14);
    expect(root.querySelector<HTMLInputElement>('input[value="male"]')?.checked).toBe(true);
  });

  it('nudges a slider by its step within its range, through an input event', () => {
    const { root, byId } = createScreen();
    const volume = byId('volume');
    const seen: string[] = [];
    volume.addEventListener('input', () => {
      seen.push((volume as HTMLInputElement).value);
    });
    const { tap } = setup(root);
    volume.focus();

    tap(15);
    tap(14);
    tap(14);
    tap(14);
    tap(14);

    expect(seen).toEqual(['0.4', '0.3', '0.2', '0.1', '0']);
  });

  it('switches tabs with left and right', () => {
    const { root, byId } = createScreen();
    const { tap } = setup(root);
    byId('tab-sound').focus();

    tap(15);

    expect(byId('tab-display')).toHaveAttribute('aria-selected', 'true');
    expect(focusedId()).toBe('tab-display');

    tap(15);
    expect(focusedId()).toBe('tab-sound');
  });

  it('turns a switch on with right and off with left, never the other way', () => {
    const { root, byId } = createScreen();
    const { tap } = setup(root);
    const toggle = byId('switch');
    toggle.focus();

    tap(14);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    tap(15);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    tap(15);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    tap(14);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('goes back with B, once per press', () => {
    const { root } = createScreen();
    const { navigation, press, onBack } = setup(root);

    press(1);
    navigation.poll();
    navigation.poll();

    expect(onBack).toHaveBeenCalledOnce();
  });

  it('leaves focus outside the root alone and does nothing without a root', () => {
    const { byId } = createScreen();
    byId('outside').focus();
    const { tap } = setup(null);

    tap(13);
    tap(0);

    expect(focusedId()).toBe('outside');
  });

  it('polls once per frame until disposed', () => {
    const { root } = createScreen();
    const { navigation, press, requestFrame, cancelFrame } = setup(root);
    expect(requestFrame).toHaveBeenCalledOnce();

    press(13);
    requestFrame.mock.calls[0]?.[0]();

    expect(focusedId()).toBe('play');
    expect(requestFrame).toHaveBeenCalledTimes(2);

    navigation.dispose();

    expect(cancelFrame).toHaveBeenCalledWith(1);
  });
});
