import { describe, expect, it, vi } from 'vitest';

import { createActionInput } from '../input/action-input';
import { attachPointerButton, type PointerEventLike, type PointerTarget } from './pointer-button';

const ACTIONS = ['moveUp', 'fire'] as const;

function createFakeButton() {
  const listeners = new Map<string, Set<(event: PointerEventLike) => void>>();
  const target: PointerTarget = {
    addEventListener(type, listener) {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
  };
  const dispatch = (type: string, pointerId: number) => {
    const event = { pointerId, preventDefault: vi.fn() };
    for (const listener of listeners.get(type) ?? []) {
      listener(event);
    }
    return event;
  };
  return {
    target,
    dispatch,
    listenerCount: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
  };
}

describe('attachPointerButton', () => {
  it('holds the action while a finger is down and stops the browser from scrolling', () => {
    const input = createActionInput(ACTIONS);
    const button = createFakeButton();
    attachPointerButton(input, 'fire', button.target);

    const down = button.dispatch('pointerdown', 1);
    expect(input.isHeld('fire')).toBe(true);
    expect(down.preventDefault).toHaveBeenCalled();

    button.dispatch('pointerup', 1);
    expect(input.isHeld('fire')).toBe(false);
  });

  it('keeps holding until every finger on the button has lifted', () => {
    const input = createActionInput(ACTIONS);
    const button = createFakeButton();
    attachPointerButton(input, 'fire', button.target);

    button.dispatch('pointerdown', 1);
    button.dispatch('pointerdown', 2);
    button.dispatch('pointerup', 1);
    expect(input.isHeld('fire')).toBe(true);

    button.dispatch('pointercancel', 2);
    expect(input.isHeld('fire')).toBe(false);
  });

  it('releases when the finger slides off the button', () => {
    const input = createActionInput(ACTIONS);
    const button = createFakeButton();
    attachPointerButton(input, 'moveUp', button.target);

    button.dispatch('pointerdown', 3);
    button.dispatch('pointerleave', 3);

    expect(input.isHeld('moveUp')).toBe(false);
  });

  it('keeps two buttons apart when the same pointer id touches both', () => {
    const input = createActionInput(ACTIONS);
    const up = createFakeButton();
    const fire = createFakeButton();
    attachPointerButton(input, 'moveUp', up.target);
    attachPointerButton(input, 'fire', fire.target);

    up.dispatch('pointerdown', 1);
    fire.dispatch('pointerdown', 1);
    fire.dispatch('pointerup', 1);

    expect(input.isHeld('moveUp')).toBe(true);
    expect(input.isHeld('fire')).toBe(false);
  });

  it('detach removes the listeners and releases the button', () => {
    const input = createActionInput(ACTIONS);
    const button = createFakeButton();
    const detach = attachPointerButton(input, 'fire', button.target);
    button.dispatch('pointerdown', 1);

    detach();

    expect(input.isHeld('fire')).toBe(false);
    expect(button.listenerCount()).toBe(0);
  });
});
