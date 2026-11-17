// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { canRumble, createHaptics, findVibrator, HAPTIC_MS, RUMBLE } from './haptics';

/** A navigator with `vibrate`, which, like the browser's, works only when called on it. */
function fakeNavigator() {
  const calls: (number | number[])[] = [];
  const navigator = {
    vibrate(this: unknown, pattern: number | number[]): boolean {
      if (this !== navigator) {
        throw new TypeError('Illegal invocation');
      }
      calls.push(pattern);
      return true;
    },
  };
  return { navigator, calls };
}

describe('findVibrator', () => {
  it('finds the vibrator of a navigator that has one, and calls it on the navigator', () => {
    const { navigator, calls } = fakeNavigator();

    const vibrator = findVibrator(navigator);
    vibrator?.vibrate(50);

    expect(calls).toEqual([50]);
  });

  it('finds none where the navigator cannot vibrate, or where there is no navigator', () => {
    expect(findVibrator({})).toBeNull();
    expect(findVibrator(undefined)).toBeNull();
  });
});

describe('createHaptics', () => {
  it('buzzes briefly on a hit on the hero', () => {
    const vibrate = vi.fn(() => true);
    const haptics = createHaptics({
      enabled: () => true,
      vibrator: { vibrate },
      gamepads: () => [],
    });

    haptics.play('hit');

    expect(vibrate).toHaveBeenCalledExactlyOnceWith(HAPTIC_MS.hit);
    expect(HAPTIC_MS.hit).toBeGreaterThan(0);
    expect(HAPTIC_MS.hit).toBeLessThanOrEqual(200);
  });

  it('follows the setting at every hit', () => {
    let enabled = false;
    const vibrate = vi.fn(() => true);
    const playEffect = vi.fn(() => Promise.resolve('complete'));
    const haptics = createHaptics({
      enabled: () => enabled,
      vibrator: { vibrate },
      gamepads: () => [{ connected: true, vibrationActuator: { playEffect } }],
    });

    haptics.play('hit');
    expect(vibrate).not.toHaveBeenCalled();
    expect(playEffect).not.toHaveBeenCalled();

    enabled = true;
    haptics.play('hit');
    expect(vibrate).toHaveBeenCalledOnce();
    expect(playEffect).toHaveBeenCalledOnce();
  });

  it('rumbles every connected gamepad that can, briefly, and only those', () => {
    const rumbled: unknown[] = [];
    const actuator = {
      playEffect(this: unknown, type: string, params: unknown): Promise<string> {
        // Like the browser's, it works only when called on the actuator.
        expect(this).toBe(actuator);
        rumbled.push([type, params]);
        return Promise.resolve('complete');
      },
    };
    const haptics = createHaptics({
      enabled: () => true,
      vibrator: null,
      gamepads: () => [
        { connected: true, vibrationActuator: actuator },
        null,
        { connected: true, vibrationActuator: null },
        { connected: true },
        { connected: false, vibrationActuator: actuator },
      ],
    });

    haptics.play('hit');

    expect(rumbled).toEqual([
      [
        'dual-rumble',
        {
          startDelay: 0,
          duration: HAPTIC_MS.hit,
          strongMagnitude: RUMBLE.strong,
          weakMagnitude: RUMBLE.weak,
        },
      ],
    ]);
  });

  it('lets a rumble the pad refuses fail quietly, and a blocked gamepad list too', async () => {
    // A plain function: a mock would itself handle the promise it returns, to record how it settled.
    let refusals = 0;
    const playEffect = (): Promise<never> => {
      refusals += 1;
      return Promise.reject(new Error('NotSupportedError'));
    };
    const haptics = createHaptics({
      enabled: () => true,
      vibrator: null,
      gamepads: () => [{ connected: true, vibrationActuator: { playEffect } }],
    });
    const blocked = createHaptics({
      enabled: () => true,
      vibrator: null,
      gamepads: () => {
        throw new Error('SecurityError');
      },
    });

    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      haptics.play('hit');
      expect(() => {
        blocked.play('hit');
      }).not.toThrow();
      // Node reports a rejection nobody handled once the microtasks have run.
      await new Promise((resolve) => setTimeout(resolve, 10));
    } finally {
      process.off('unhandledRejection', unhandled);
    }

    expect(refusals).toBe(1);
    expect(unhandled).not.toHaveBeenCalled();
  });
});

describe('canRumble', () => {
  it('tells whether the browser has gamepad haptics', () => {
    expect(canRumble({ GamepadHapticActuator: vi.fn() })).toBe(true);
    expect(canRumble({})).toBe(false);
  });
});
