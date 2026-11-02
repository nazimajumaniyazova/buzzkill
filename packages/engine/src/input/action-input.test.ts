// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import { createActionInput, isActionDown } from './action-input';

const ACTIONS = ['moveUp', 'moveDown', 'fire', 'pause'] as const;
const UP = 0b0001;
const DOWN = 0b0010;
const FIRE = 0b0100;

function setup() {
  return createActionInput(ACTIONS);
}

describe('createActionInput', () => {
  it('assigns bits in the order of the action list', () => {
    const input = setup();

    expect(ACTIONS.map((action) => input.bit(action))).toEqual([1, 2, 4, 8]);
    expect(input.actions).toEqual(ACTIONS);
  });

  it('reports a held action as down until it is released', () => {
    const input = setup();

    input.press('moveUp', 'key:ArrowUp');
    expect(input.isHeld('moveUp')).toBe(true);
    expect(input.sample()).toEqual({ down: UP, pressed: UP, released: 0 });
    expect(input.sample()).toEqual({ down: UP, pressed: 0, released: 0 });

    input.release('moveUp', 'key:ArrowUp');
    expect(input.isHeld('moveUp')).toBe(false);
    expect(input.sample()).toEqual({ down: 0, pressed: 0, released: UP });
    expect(input.sample()).toEqual({ down: 0, pressed: 0, released: 0 });
  });

  it('releases only the key that was released (the legacy handler dropped the last one)', () => {
    const input = setup();
    input.press('moveUp', 'key:ArrowUp');
    input.press('moveDown', 'key:ArrowDown');
    input.sample();

    input.release('moveUp', 'key:ArrowUp');

    expect(input.sample()).toEqual({ down: DOWN, pressed: 0, released: UP });
  });

  it('ignores key auto-repeat and releases of sources that hold nothing', () => {
    const input = setup();
    input.press('fire', 'key:Space');
    input.press('fire', 'key:Space');
    input.press('fire', 'key:Space');
    input.release('moveUp', 'key:ArrowUp');
    input.release('fire', 'key:KeyJ');

    expect(input.sample().down).toBe(FIRE);

    input.release('fire', 'key:Space');
    expect(input.sample().down).toBe(0);
  });

  it('keeps an action held while any of several simultaneous sources holds it', () => {
    const input = setup();
    input.press('fire', 'key:Space');
    input.press('fire', 'pointer:fire:1');
    input.press('fire', 'pad:0:b0');

    input.release('fire', 'key:Space');
    expect(input.isHeld('fire')).toBe(true);
    input.release('fire', 'pad:0:b0');
    expect(input.isHeld('fire')).toBe(true);
    input.release('fire', 'pointer:fire:1');
    expect(input.isHeld('fire')).toBe(false);
  });

  it('does not lose a tap that starts and ends between two samples', () => {
    const input = setup();
    input.sample();

    input.press('fire', 'pointer:fire:7');
    input.release('fire', 'pointer:fire:7');

    expect(input.sample()).toEqual({ down: FIRE, pressed: FIRE, released: 0 });
    expect(input.sample()).toEqual({ down: 0, pressed: 0, released: FIRE });
  });

  it('treats a release followed by a press within one tick as a continuous hold', () => {
    const input = setup();
    input.press('moveUp', 'key:ArrowUp');
    input.sample();

    input.release('moveUp', 'key:ArrowUp');
    input.press('moveUp', 'key:KeyW');

    expect(input.sample()).toEqual({ down: UP, pressed: 0, released: 0 });
  });

  it('releases every source with a prefix, leaving the others', () => {
    const input = setup();
    input.press('moveUp', 'key:ArrowUp');
    input.press('fire', 'key:Space');
    input.press('fire', 'pad:0:b0');

    input.releaseSources('key:');

    expect(input.isHeld('moveUp')).toBe(false);
    expect(input.isHeld('fire')).toBe(true);
  });

  it('reset forgets holds and the previous sample', () => {
    const input = setup();
    input.press('moveUp', 'key:ArrowUp');
    input.sample();

    input.reset();

    expect(input.sample()).toEqual({ down: 0, pressed: 0, released: 0 });
  });

  it('reuses one snapshot object so a tick allocates nothing', () => {
    const input = setup();

    expect(input.sample()).toBe(input.sample());
  });

  it('reads single bits through isActionDown', () => {
    const input = setup();
    input.press('pause', 'key:Escape');
    const { down } = input.sample();

    expect(isActionDown(input, down, 'pause')).toBe(true);
    expect(isActionDown(input, down, 'fire')).toBe(false);
  });

  it('supports 32 actions, bit 31 included', () => {
    const many = Array.from({ length: 32 }, (_, index) => `a${String(index)}`);
    const input = createActionInput(many);

    input.press('a31', 'key:X');

    expect(isActionDown(input, input.sample().down, 'a31')).toBe(true);
  });

  it('rejects empty, oversized and duplicate action lists and unknown actions', () => {
    expect(() => createActionInput([])).toThrow(RangeError);
    expect(() =>
      createActionInput(Array.from({ length: 33 }, (_, index) => `a${String(index)}`)),
    ).toThrow(RangeError);
    expect(() => createActionInput(['fire', 'fire'])).toThrow(/duplicate/);
    const input = setup();
    // Simulates a caller outside TypeScript passing a name that is not in the list.
    expect(() => {
      input.press('jump' as 'fire', 'key:Space');
    }).toThrow(RangeError);
  });

  const event = fc.record({
    kind: fc.constantFrom('press', 'release', 'sample'),
    action: fc.constantFrom(...ACTIONS),
    source: fc.constantFrom('key:A', 'key:B', 'pointer:fire:1', 'pad:0:b0'),
  });

  test.prop([fc.array(event, { maxLength: 80 })])(
    'agrees with a model: held while any source holds it, taps reach the next sample',
    (events) => {
      const input = setup();
      const model = new Map<string, Set<string>>(ACTIONS.map((action) => [action, new Set()]));
      let tapped = 0;
      let previous = 0;
      const heldMask = (): number =>
        ACTIONS.reduce(
          (mask, action, index) =>
            (model.get(action)?.size ?? 0) > 0 ? mask | (1 << index) : mask,
          0,
        );

      for (const { kind, action, source } of events) {
        if (kind === 'press') {
          input.press(action, source);
          model.get(action)?.add(source);
          tapped |= input.bit(action);
        } else if (kind === 'release') {
          input.release(action, source);
          model.get(action)?.delete(source);
        } else {
          const down = heldMask() | tapped;
          expect(input.sample()).toEqual({
            down,
            pressed: down & ~previous,
            released: previous & ~down,
          });
          previous = down;
          tapped = 0;
        }
        for (const name of ACTIONS) {
          expect(input.isHeld(name)).toBe((model.get(name)?.size ?? 0) > 0);
        }
      }
    },
  );
});
