// @vitest-environment node
import type { GameLoopHost } from '@buzzkill/engine';
import { describe, expect, it, vi } from 'vitest';

import { adjustablePacedHost, pacedHost } from './paced-host';

/** A host whose frames the test delivers at the real times it chooses. */
function createFakeHost() {
  const pending: ((timeMs: number) => void)[] = [];
  const cancelFrame = vi.fn();
  const subscribeVisibility = vi.fn(() => () => undefined);
  const host: GameLoopHost = {
    requestFrame: (callback) => {
      pending.push(callback);
      return pending.length;
    },
    cancelFrame,
    subscribeVisibility,
  };
  const frame = (timeMs: number): void => {
    pending.shift()?.(timeMs);
  };
  return { host, frame, cancelFrame, subscribeVisibility };
}

/** The times the loop sees for frames at `realTimes`. */
function pacedTimes(speed: number, realTimes: readonly number[]): number[] {
  const { host, frame } = createFakeHost();
  const paced = pacedHost(host, speed);
  const seen: number[] = [];
  for (const time of realTimes) {
    paced.requestFrame((timeMs) => {
      seen.push(timeMs);
    });
    frame(time);
  }
  return seen;
}

describe('pacedHost', () => {
  it('gives the host itself at normal speed', () => {
    const { host } = createFakeHost();

    expect(pacedHost(host, 1)).toBe(host);
  });

  it('lets the loop see the time pass at the given speed', () => {
    expect(pacedTimes(0.5, [1000, 1016, 1048, 1100])).toEqual([0, 8, 24, 50]);
    expect(pacedTimes(0.75, [0, 40, 80])).toEqual([0, 30, 60]);
  });

  it('passes cancelling and the visibility subscription through', () => {
    const { host, cancelFrame, subscribeVisibility } = createFakeHost();
    const paced = pacedHost(host, 0.5);

    paced.cancelFrame(3);
    paced.subscribeVisibility?.(() => undefined);

    expect(cancelFrame).toHaveBeenCalledWith(3);
    expect(subscribeVisibility).toHaveBeenCalledOnce();
  });

  it('refuses a speed outside (0, 1]', () => {
    const { host } = createFakeHost();

    for (const speed of [0, -1, 1.5, Number.NaN]) {
      expect(() => pacedHost(host, speed)).toThrow(RangeError);
    }
  });
});

describe('adjustablePacedHost', () => {
  /** The times the loop sees for frames at `realTimes`, at the speed set before each frame. */
  function adjustedTimes(frames: readonly (readonly [number, number])[]): number[] {
    const { host, frame } = createFakeHost();
    let speed = 1;
    const paced = adjustablePacedHost(host, () => speed);
    const seen: number[] = [];
    for (const [time, speedThen] of frames) {
      speed = speedThen;
      paced.requestFrame((timeMs) => {
        seen.push(timeMs);
      });
      frame(time);
    }
    return seen;
  }

  it('runs the clock faster than real time, for a replay (#219)', () => {
    expect(
      adjustedTimes([
        [0, 4],
        [10, 4],
        [30, 2],
      ]),
    ).toEqual([0, 40, 80]);
  });

  it('applies a new speed from the next frame, without moving the time already seen', () => {
    expect(
      adjustedTimes([
        [0, 1],
        [100, 1],
        [200, 0.5],
        [300, 4],
      ]),
    ).toEqual([0, 100, 150, 550]);
  });
});
