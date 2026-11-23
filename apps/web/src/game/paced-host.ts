import type { GameLoopHost } from '@buzzkill/engine';

/**
 * A frame host whose clock runs at `speed` (#114, ADR-0014): each frame gives the loop a time
 * that has moved on by `speed` times the real time since the frame before. At 0.5 the loop sees
 * half the time pass and runs half the ticks a second. The ticks and their `dt` stay those of
 * normal speed, so the simulation, its replay and its hash are the same at every pace. A pause
 * or a hidden tab leaves a gap, which the loop ignores as it does at normal speed.
 */
export function pacedHost(host: GameLoopHost, speed: number): GameLoopHost {
  if (!(speed > 0 && speed <= 1)) {
    throw new RangeError(`pacedHost: speed must be in (0, 1], got ${String(speed)}`);
  }
  return speed === 1 ? host : adjustablePacedHost(host, () => speed);
}

/**
 * The same clock at a speed that may change while it runs, for a replay watched at 0.5× to 4×
 * (#219). `speed()` is read once per frame, for the time since the frame before, and must be
 * positive; the time the loop has already seen never moves. Above 1 the loop runs several ticks a
 * frame, as many as its `maxTicksPerAdvance` allows.
 */
export function adjustablePacedHost(host: GameLoopHost, speed: () => number): GameLoopHost {
  let lastRealMs: number | null = null;
  let pacedMs = 0;
  return {
    ...host,
    requestFrame: (callback) =>
      host.requestFrame((timeMs) => {
        pacedMs += lastRealMs === null ? 0 : (timeMs - lastRealMs) * speed();
        lastRealMs = timeMs;
        callback(pacedMs);
      }),
  };
}
