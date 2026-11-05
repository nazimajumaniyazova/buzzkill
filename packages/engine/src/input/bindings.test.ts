import { describe, expect, it } from 'vitest';

import { type KeyBindings, rebindKey } from './bindings';

type Action = 'moveUp' | 'moveDown' | 'fire' | 'pause';

const BINDINGS: KeyBindings<Action> = {
  moveUp: ['ArrowUp', 'KeyW'],
  moveDown: ['ArrowDown', 'KeyS'],
  fire: ['Space'],
  pause: ['Escape'],
};

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
