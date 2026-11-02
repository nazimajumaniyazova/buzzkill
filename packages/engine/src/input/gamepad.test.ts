import { describe, expect, it } from 'vitest';

import { createActionInput } from './action-input';
import { createGamepadSource, type GamepadBindings, type GamepadLike } from './gamepad';

const ACTIONS = ['moveUp', 'moveDown', 'fire', 'pause'] as const;
type Action = (typeof ACTIONS)[number];

const BINDINGS: GamepadBindings<Action> = {
  buttons: { moveUp: [12], moveDown: [13], fire: [0], pause: [9] },
  axes: { moveUp: [{ axis: 1, direction: -1 }], moveDown: [{ axis: 1, direction: 1 }] },
};

/** A mutable pad in the shape of the standard mapping: 17 buttons, 4 axes. */
function createPad(index = 0) {
  const pad = {
    index,
    connected: true,
    buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
    axes: [0, 0, 0, 0],
  };
  return {
    pad,
    press(button: number, pressed = true) {
      const control = pad.buttons[button];
      if (control !== undefined) {
        control.pressed = pressed;
      }
    },
    stick(axis: number, value: number) {
      pad.axes[axis] = value;
    },
  };
}

function setup(pads: (GamepadLike | null)[], deadzone?: number) {
  const input = createActionInput(ACTIONS);
  const source = createGamepadSource(input, {
    bindings: BINDINGS,
    getGamepads: () => pads,
    ...(deadzone === undefined ? {} : { deadzone }),
  });
  return { input, source };
}

describe('createGamepadSource', () => {
  it('turns buttons into actions on each poll', () => {
    const first = createPad();
    const { input, source } = setup([first.pad]);

    first.press(0);
    source.poll();
    expect(input.isHeld('fire')).toBe(true);

    first.press(0, false);
    source.poll();
    expect(input.isHeld('fire')).toBe(false);
  });

  it('reads stick directions past the deadzone only', () => {
    const first = createPad();
    const { input, source } = setup([first.pad]);

    first.stick(1, -0.3);
    source.poll();
    expect(input.isHeld('moveUp')).toBe(false);

    first.stick(1, -0.8);
    source.poll();
    expect(input.isHeld('moveUp')).toBe(true);
    expect(input.isHeld('moveDown')).toBe(false);

    first.stick(1, 0.9);
    source.poll();
    expect(input.isHeld('moveUp')).toBe(false);
    expect(input.isHeld('moveDown')).toBe(true);
  });

  it('keeps an action held while the D-pad or the stick still holds it', () => {
    const first = createPad();
    const { input, source } = setup([first.pad]);
    first.press(12);
    first.stick(1, -1);
    source.poll();

    first.press(12, false);
    source.poll();

    expect(input.isHeld('moveUp')).toBe(true);
  });

  it('combines several pads and the keyboard on one action', () => {
    const first = createPad(0);
    const second = createPad(1);
    const { input, source } = setup([first.pad, null, second.pad]);
    input.press('fire', 'key:Space');
    first.press(0);
    second.press(0);
    source.poll();

    input.release('fire', 'key:Space');
    first.press(0, false);
    source.poll();
    expect(input.isHeld('fire')).toBe(true);

    second.press(0, false);
    source.poll();
    expect(input.isHeld('fire')).toBe(false);
  });

  it('releases what a pad held when it disconnects', () => {
    const first = createPad();
    const pads: (GamepadLike | null)[] = [first.pad];
    const { input, source } = setup(pads);
    first.press(9);
    source.poll();
    expect(input.isHeld('pause')).toBe(true);

    pads[0] = null;
    source.poll();

    expect(input.isHeld('pause')).toBe(false);
  });

  it('ignores a pad marked as disconnected', () => {
    const first = createPad();
    first.press(0);
    first.pad.connected = false;
    const { input, source } = setup([first.pad]);

    source.poll();

    expect(input.isHeld('fire')).toBe(false);
  });

  it('applies new bindings and releases the old holds', () => {
    const first = createPad();
    const { input, source } = setup([first.pad]);
    first.press(0);
    source.poll();

    source.setBindings({ buttons: { fire: [1] } });
    expect(input.isHeld('fire')).toBe(false);
    source.poll();
    expect(input.isHeld('fire')).toBe(false);

    first.press(1);
    source.poll();
    expect(input.isHeld('fire')).toBe(true);
  });

  it('treats buttons and axes the pad does not have as released', () => {
    const { input, source } = setup([{ index: 0, connected: true, buttons: [], axes: [] }]);

    source.poll();

    expect(input.sample().down).toBe(0);
  });

  it('dispose releases every gamepad hold', () => {
    const first = createPad();
    const { input, source } = setup([first.pad]);
    first.press(0);
    source.poll();

    source.dispose();

    expect(input.isHeld('fire')).toBe(false);
  });

  it('rejects a deadzone outside (0, 1]', () => {
    expect(() => setup([], 0)).toThrow(RangeError);
    expect(() => setup([], 1.5)).toThrow(RangeError);
  });
});
