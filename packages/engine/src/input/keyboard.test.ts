import { describe, expect, it, vi } from 'vitest';

import { createActionInput } from './action-input';
import {
  createKeyboardSource,
  type KeyBindings,
  type KeyboardEventLike,
  type KeyboardTarget,
  rebindKey,
} from './keyboard';

const ACTIONS = ['moveUp', 'moveDown', 'fire', 'pause'] as const;
type Action = (typeof ACTIONS)[number];

const BINDINGS: KeyBindings<Action> = {
  moveUp: ['ArrowUp', 'KeyW'],
  moveDown: ['ArrowDown', 'KeyS'],
  fire: ['Space'],
  pause: ['Escape'],
};

/** A `window` stand-in that dispatches key events by hand; no jsdom needed. */
function createFakeWindow() {
  const listeners = new Map<string, Set<(event: KeyboardEventLike) => void>>();
  const target: KeyboardTarget = {
    addEventListener(type: string, listener: (event: KeyboardEventLike) => void) {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener(type: string, listener: (event: KeyboardEventLike) => void) {
      listeners.get(type)?.delete(listener);
    },
  };
  const dispatch = (type: string, code = ''): { preventDefault: ReturnType<typeof vi.fn> } => {
    const event = { code, preventDefault: vi.fn() };
    for (const listener of listeners.get(type) ?? []) {
      listener(event);
    }
    return event;
  };
  return {
    target,
    keydown: (code: string) => dispatch('keydown', code),
    keyup: (code: string) => dispatch('keyup', code),
    blur: () => dispatch('blur'),
    listenerCount: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
  };
}

function setup(bindings: KeyBindings<Action> = BINDINGS) {
  const input = createActionInput(ACTIONS);
  const fake = createFakeWindow();
  const source = createKeyboardSource(input, bindings, fake.target);
  return { input, fake, source };
}

describe('createKeyboardSource', () => {
  it('turns bound keys into actions and keeps the page from scrolling on them', () => {
    const { input, fake } = setup();

    const event = fake.keydown('ArrowUp');

    expect(input.isHeld('moveUp')).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    fake.keyup('ArrowUp');
    expect(input.isHeld('moveUp')).toBe(false);
  });

  it('leaves unbound keys to the browser', () => {
    const { input, fake } = setup();

    const event = fake.keydown('KeyQ');

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(input.sample().down).toBe(0);
  });

  it('keeps an action held while a second key bound to it is still down', () => {
    const { input, fake } = setup();
    fake.keydown('ArrowUp');
    fake.keydown('KeyW');

    fake.keyup('ArrowUp');

    expect(input.isHeld('moveUp')).toBe(true);
    fake.keyup('KeyW');
    expect(input.isHeld('moveUp')).toBe(false);
  });

  it('releases every key when the window loses focus and the keyup never comes', () => {
    const { input, fake } = setup();
    input.press('fire', 'pad:0:b0');
    fake.keydown('ArrowUp');
    fake.keydown('Space');

    fake.blur();

    expect(input.isHeld('moveUp')).toBe(false);
    expect(input.isHeld('fire')).toBe(true);
  });

  it('applies new bindings at runtime and releases keys held under the old ones', () => {
    const { input, fake, source } = setup();
    fake.keydown('Space');

    source.setBindings(rebindKey(BINDINGS, 'fire', 'KeyJ'));

    expect(input.isHeld('fire')).toBe(false);
    fake.keydown('Space');
    expect(input.isHeld('fire')).toBe(false);
    fake.keydown('KeyJ');
    expect(input.isHeld('fire')).toBe(true);
  });

  it('lets one key hold two actions when the bindings ask for it', () => {
    const { input, fake } = setup({ ...BINDINGS, pause: ['Escape', 'Space'] });

    fake.keydown('Space');

    expect(input.isHeld('fire')).toBe(true);
    expect(input.isHeld('pause')).toBe(true);
  });

  it('dispose removes the listeners and releases the keys', () => {
    const { input, fake, source } = setup();
    fake.keydown('ArrowDown');

    source.dispose();

    expect(fake.listenerCount()).toBe(0);
    expect(input.isHeld('moveDown')).toBe(false);
    fake.keydown('ArrowDown');
    expect(input.isHeld('moveDown')).toBe(false);
  });
});

describe('rebindKey', () => {
  it('replaces the key in the given slot and returns new bindings', () => {
    const next = rebindKey(BINDINGS, 'moveUp', 'KeyI');

    expect(next.moveUp).toEqual(['KeyI', 'KeyW']);
    expect(BINDINGS.moveUp).toEqual(['ArrowUp', 'KeyW']);
  });

  it('appends when the slot is past the end', () => {
    expect(rebindKey(BINDINGS, 'fire', 'KeyJ', 1).fire).toEqual(['Space', 'KeyJ']);
    expect(rebindKey(BINDINGS, 'fire', 'KeyJ', 5).fire).toEqual(['Space', 'KeyJ']);
  });

  it('takes the key away from the action that had it', () => {
    const next = rebindKey(BINDINGS, 'fire', 'KeyW');

    expect(next.fire).toEqual(['KeyW']);
    expect(next.moveUp).toEqual(['ArrowUp']);
  });

  it('does not duplicate a key that the action already had in another slot', () => {
    expect(rebindKey(BINDINGS, 'moveUp', 'KeyW', 0).moveUp).toEqual(['KeyW']);
  });

  it('rejects a negative or fractional slot', () => {
    expect(() => rebindKey(BINDINGS, 'fire', 'KeyJ', -1)).toThrow(RangeError);
    expect(() => rebindKey(BINDINGS, 'fire', 'KeyJ', 0.5)).toThrow(RangeError);
  });
});
