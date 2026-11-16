// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it, vi } from 'vitest';

import { createActionInput } from '../input/action-input';
import {
  attachPointerStick,
  DEFAULT_STICK_DEAD_ZONE,
  stickDirection,
  type StickEventLike,
  stickOffset,
  type StickTarget,
} from './pointer-stick';

const ACTIONS = ['moveUp', 'moveDown', 'fire'] as const;
const STICK = { up: 'moveUp', down: 'moveDown' } as const;

/** A stick 200 px tall whose top is at 400 px: its center is at 500 px, its travel 100 px. */
function createFakeStick(rect = { top: 400, height: 200 }) {
  const listeners = new Map<string, Set<(event: StickEventLike) => void>>();
  const setPointerCapture = vi.fn();
  const target: StickTarget = {
    addEventListener(type, listener) {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    setPointerCapture,
    getBoundingClientRect: () => rect,
  };
  const dispatch = (type: string, pointerId: number, clientY = 500) => {
    const event = { pointerId, clientY, preventDefault: vi.fn() };
    for (const listener of listeners.get(type) ?? []) {
      listener(event);
    }
    return event;
  };
  return {
    target,
    setPointerCapture,
    dispatch,
    listenerCount: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
  };
}

describe('stickOffset', () => {
  it('is the distance from the center as a fraction of the travel, -1 up and 1 down', () => {
    expect(stickOffset(-50, 100)).toBe(-0.5);
    expect(stickOffset(25, 100)).toBe(0.25);
    expect(stickOffset(0, 100)).toBe(0);
  });

  it('stops at the edge when the finger goes past it', () => {
    expect(stickOffset(-300, 100)).toBe(-1);
    expect(stickOffset(101, 100)).toBe(1);
  });

  it('is 0 for a stick with no size, which has nowhere to steer', () => {
    expect(stickOffset(40, 0)).toBe(0);
  });

  test.prop([fc.double({ min: -1e4, max: 1e4, noNaN: true }), fc.double({ min: 1, max: 1e4 })])(
    'always lies between -1 and 1',
    (distance, travel) => {
      const offset = stickOffset(distance, travel);
      expect(offset).toBeGreaterThanOrEqual(-1);
      expect(offset).toBeLessThanOrEqual(1);
    },
  );
});

describe('stickDirection', () => {
  it('steers up past the dead zone above the center and down past it below', () => {
    expect(stickDirection(-0.5, 0.25)).toBe(-1);
    expect(stickDirection(0.5, 0.25)).toBe(1);
  });

  it('steers nowhere inside the dead zone, its edge included, so a resting thumb keeps still', () => {
    expect(stickDirection(0, 0.25)).toBe(0);
    expect(stickDirection(0.25, 0.25)).toBe(0);
    expect(stickDirection(-0.25, 0.25)).toBe(0);
    expect(stickDirection(0.26, 0.25)).toBe(1);
  });

  test.prop([fc.double({ min: -1, max: 1, noNaN: true }), fc.double({ min: 0, max: 0.9 })])(
    'mirrors: the same distance up and down steers opposite ways',
    (offset, deadZone) => {
      // A sum, not a negation: -0 and 0 are different values to `toBe`.
      expect(stickDirection(-offset, deadZone) + stickDirection(offset, deadZone)).toBe(0);
    },
  );
});

describe('attachPointerStick', () => {
  it('holds up while the finger is above the dead zone and down while it is below', () => {
    const input = createActionInput(ACTIONS);
    const stick = createFakeStick();
    attachPointerStick(input, STICK, stick.target);

    const down = stick.dispatch('pointerdown', 1, 430);
    expect(input.isHeld('moveUp')).toBe(true);
    expect(input.isHeld('moveDown')).toBe(false);
    expect(down.preventDefault).toHaveBeenCalled();

    stick.dispatch('pointermove', 1, 570);
    expect(input.isHeld('moveUp')).toBe(false);
    expect(input.isHeld('moveDown')).toBe(true);

    stick.dispatch('pointermove', 1, 510);
    expect(input.isHeld('moveUp')).toBe(false);
    expect(input.isHeld('moveDown')).toBe(false);
  });

  it('captures the finger, so it keeps steering after it slides off the stick', () => {
    const input = createActionInput(ACTIONS);
    const stick = createFakeStick();
    attachPointerStick(input, STICK, stick.target);

    stick.dispatch('pointerdown', 7, 500);
    stick.dispatch('pointermove', 7, 100);

    expect(stick.setPointerCapture).toHaveBeenCalledWith(7);
    expect(input.isHeld('moveUp')).toBe(true);
  });

  it.each(['pointerup', 'pointercancel', 'lostpointercapture'])('lets go on %s', (end) => {
    const input = createActionInput(ACTIONS);
    const stick = createFakeStick();
    attachPointerStick(input, STICK, stick.target);
    stick.dispatch('pointerdown', 1, 420);

    stick.dispatch(end, 1);

    expect(input.isHeld('moveUp')).toBe(false);
  });

  it('follows the first finger only, and the next one once the first has lifted', () => {
    const input = createActionInput(ACTIONS);
    const stick = createFakeStick();
    attachPointerStick(input, STICK, stick.target);

    stick.dispatch('pointerdown', 1, 420);
    stick.dispatch('pointerdown', 2, 580);
    stick.dispatch('pointermove', 2, 590);
    stick.dispatch('pointerup', 2);
    expect(input.isHeld('moveUp')).toBe(true);
    expect(input.isHeld('moveDown')).toBe(false);

    stick.dispatch('pointerup', 1);
    stick.dispatch('pointerdown', 2, 580);
    expect(input.isHeld('moveDown')).toBe(true);
  });

  it('measures the stick when a finger lands, so a moved or resized stick steers right', () => {
    const input = createActionInput(ACTIONS);
    const rect = { top: 400, height: 200 };
    const stick = createFakeStick(rect);
    attachPointerStick(input, STICK, stick.target);
    stick.dispatch('pointerdown', 1, 450);
    stick.dispatch('pointerup', 1);

    rect.top = 0;
    stick.dispatch('pointerdown', 1, 450);

    expect(input.isHeld('moveUp')).toBe(false);
    expect(input.isHeld('moveDown')).toBe(true);
  });

  it('steers with the dead zone it is given', () => {
    const input = createActionInput(ACTIONS);
    const stick = createFakeStick();
    attachPointerStick(input, STICK, stick.target, { deadZone: 0.6 });

    stick.dispatch('pointerdown', 1, 450);
    expect(input.isHeld('moveUp')).toBe(false);

    stick.dispatch('pointermove', 1, 430);
    expect(input.isHeld('moveUp')).toBe(true);
  });

  it('has a default dead zone of a quarter of its travel', () => {
    expect(DEFAULT_STICK_DEAD_ZONE).toBe(0.25);
  });

  it('reports where the knob goes: the offset while a finger steers, and 0 when it lifts', () => {
    const input = createActionInput(ACTIONS);
    const stick = createFakeStick();
    const onMove = vi.fn();
    attachPointerStick(input, STICK, stick.target, { onMove });

    stick.dispatch('pointerdown', 1, 460);
    stick.dispatch('pointermove', 1, 900);
    stick.dispatch('pointerup', 1);

    expect(onMove.mock.calls).toEqual([[-0.4], [1], [0]]);
  });

  it('shares the actions with other sources: a key held on moveUp outlasts the stick', () => {
    const input = createActionInput(ACTIONS);
    const stick = createFakeStick();
    attachPointerStick(input, STICK, stick.target);
    input.press('moveUp', 'key:ArrowUp');

    stick.dispatch('pointerdown', 1, 420);
    stick.dispatch('pointerup', 1);

    expect(input.isHeld('moveUp')).toBe(true);
  });

  it('detach removes the listeners, lets go and centers the knob', () => {
    const input = createActionInput(ACTIONS);
    const stick = createFakeStick();
    const onMove = vi.fn();
    const detach = attachPointerStick(input, STICK, stick.target, { onMove });
    stick.dispatch('pointerdown', 1, 420);

    detach();

    expect(input.isHeld('moveUp')).toBe(false);
    expect(stick.listenerCount()).toBe(0);
    expect(onMove).toHaveBeenLastCalledWith(0);
  });

  it('refuses a dead zone outside [0, 1), where it could never steer', () => {
    const input = createActionInput(ACTIONS);
    for (const deadZone of [-0.1, 1, Number.NaN]) {
      expect(() =>
        attachPointerStick(input, STICK, createFakeStick().target, { deadZone }),
      ).toThrow(RangeError);
    }
  });
});
