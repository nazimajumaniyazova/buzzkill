// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { createHaptics, findVibrator, HAPTIC_MS } from './haptics';

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
    const haptics = createHaptics({ enabled: () => true, vibrator: { vibrate } });

    haptics.play('hit');

    expect(vibrate).toHaveBeenCalledExactlyOnceWith(HAPTIC_MS.hit);
    expect(HAPTIC_MS.hit).toBeGreaterThan(0);
    expect(HAPTIC_MS.hit).toBeLessThanOrEqual(200);
  });

  it('follows the setting at every hit', () => {
    let enabled = false;
    const vibrate = vi.fn(() => true);
    const haptics = createHaptics({ enabled: () => enabled, vibrator: { vibrate } });

    haptics.play('hit');
    expect(vibrate).not.toHaveBeenCalled();

    enabled = true;
    haptics.play('hit');
    expect(vibrate).toHaveBeenCalledOnce();
  });
});
