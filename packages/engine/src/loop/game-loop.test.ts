import { describe, expect, it, vi } from 'vitest';

import { createGameLoop, type GameLoopCallbacks, type GameLoopHost } from './game-loop';

// 50 Hz gives a 20 ms step that is exact in binary floating point, so frame timestamps built from
// it subtract exactly and the tests can count ticks. At 60 Hz two frames one step apart may yield
// 0 and 2 ticks through rounding alone; the fixed-timestep tests and the default-rate test below
// cover that rate.
const HZ = 50;
const STEP = 1000 / HZ;

/** A host whose frames and visibility are driven by the test instead of the browser. */
function createFakeHost() {
  const frames = new Map<number, (timeMs: number) => void>();
  const listeners = new Set<(hidden: boolean) => void>();
  let nextHandle = 1;
  let lastRequested: ((timeMs: number) => void) | null = null;

  const host: GameLoopHost = {
    requestFrame(callback) {
      const handle = nextHandle;
      nextHandle += 1;
      frames.set(handle, callback);
      lastRequested = callback;
      return handle;
    },
    cancelFrame(handle) {
      frames.delete(handle);
    },
    subscribeVisibility(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return {
    host,
    get pendingFrames(): number {
      return frames.size;
    },
    get visibilityListeners(): number {
      return listeners.size;
    },
    /** Delivers every pending frame (normally exactly one) with the given timestamp. */
    runFrame(timeMs: number): void {
      const due = [...frames.values()];
      frames.clear();
      for (const callback of due) {
        callback(timeMs);
      }
    },
    /** Delivers the most recently requested frame even if it was cancelled, as a browser may. */
    runStaleFrame(timeMs: number): void {
      lastRequested?.(timeMs);
    },
    setHidden(hidden: boolean): void {
      for (const listener of listeners) {
        listener(hidden);
      }
    },
  };
}

function createCallbacks() {
  return {
    update: vi.fn<GameLoopCallbacks['update']>(),
    render: vi.fn<GameLoopCallbacks['render']>(),
    onBacklogDropped: vi.fn<(droppedMs: number) => void>(),
  };
}

function setup(options: { maxTicksPerAdvance?: number } = {}) {
  const fake = createFakeHost();
  const callbacks = createCallbacks();
  const loop = createGameLoop(callbacks, { host: fake.host, hz: HZ, ...options });
  return { fake, callbacks, loop };
}

/** Tick numbers passed to `update`, in order. */
function ticksOf(update: { mock: { calls: [number, number][] } }): number[] {
  return update.mock.calls.map(([tick]) => tick);
}

describe('createGameLoop', () => {
  it('schedules the first frame on start and only renders it, having no earlier frame to measure', () => {
    const { fake, callbacks, loop } = setup();

    loop.start();
    expect(loop.status).toBe('running');
    expect(fake.pendingFrames).toBe(1);

    fake.runFrame(1000);
    expect(callbacks.update).not.toHaveBeenCalled();
    expect(callbacks.render).toHaveBeenCalledExactlyOnceWith(0);
    expect(fake.pendingFrames).toBe(1);
  });

  it('simulates one numbered tick per frame at the display rate with a constant step', () => {
    const { fake, callbacks, loop } = setup();
    loop.start();

    for (let frame = 0; frame <= 10; frame += 1) {
      fake.runFrame(1000 + frame * STEP);
    }

    expect(ticksOf(callbacks.update)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(callbacks.update).toHaveBeenLastCalledWith(9, 1 / HZ);
    expect(callbacks.render).toHaveBeenCalledTimes(11);
    expect(loop.tick).toBe(10);
  });

  it('runs two ticks on a half-rate frame and none on a frame that arrives early', () => {
    const { fake, callbacks, loop } = setup();
    loop.start();
    fake.runFrame(1000);

    fake.runFrame(1000 + 2 * STEP);
    expect(callbacks.update).toHaveBeenCalledTimes(2);

    fake.runFrame(1000 + 2 * STEP + 5);
    expect(callbacks.update).toHaveBeenCalledTimes(2);
    expect(callbacks.render).toHaveBeenLastCalledWith(5 / STEP);
  });

  it('caps the catch-up after a stall and reports the discarded backlog', () => {
    const { fake, callbacks, loop } = setup({ maxTicksPerAdvance: 5 });
    loop.start();
    fake.runFrame(0);

    fake.runFrame(1000);

    expect(callbacks.update).toHaveBeenCalledTimes(5);
    expect(callbacks.onBacklogDropped).toHaveBeenCalledExactlyOnceWith(1000 - 5 * STEP);
    expect(callbacks.render).toHaveBeenCalledTimes(2);
  });

  it('defaults to 60 Hz and a cap of five ticks', () => {
    const fake = createFakeHost();
    const callbacks = createCallbacks();
    const loop = createGameLoop(callbacks, { host: fake.host });
    loop.start();
    fake.runFrame(0);

    fake.runFrame(1000);

    expect(callbacks.update).toHaveBeenCalledTimes(5);
    expect(callbacks.update).toHaveBeenLastCalledWith(4, 1 / 60);
    expect(callbacks.onBacklogDropped).toHaveBeenCalledExactlyOnceWith(
      expect.closeTo(1000 - (5 * 1000) / 60, 6),
    );
  });

  it('simulates nothing for a frame whose timestamp went backwards', () => {
    const { fake, callbacks, loop } = setup();
    loop.start();
    fake.runFrame(1000);

    fake.runFrame(900);
    expect(callbacks.update).not.toHaveBeenCalled();

    fake.runFrame(900 + STEP);
    expect(callbacks.update).toHaveBeenCalledTimes(1);
  });

  it('stops frames while the page is hidden and comes back without simulating the hidden time', () => {
    const { fake, callbacks, loop } = setup();
    loop.start();
    fake.runFrame(0);
    fake.runFrame(STEP);
    expect(callbacks.update).toHaveBeenCalledTimes(1);

    fake.setHidden(true);
    expect(loop.hidden).toBe(true);
    expect(loop.status).toBe('running');
    expect(fake.pendingFrames).toBe(0);

    fake.setHidden(false);
    expect(loop.hidden).toBe(false);
    expect(fake.pendingFrames).toBe(1);

    fake.runFrame(60_000);
    expect(callbacks.update).toHaveBeenCalledTimes(1);
    expect(callbacks.onBacklogDropped).not.toHaveBeenCalled();
    fake.runFrame(60_000 + STEP);
    expect(callbacks.update).toHaveBeenCalledTimes(2);
    expect(loop.tick).toBe(2);
  });

  it('ignores a repeated visibility report', () => {
    const { fake, loop } = setup();
    loop.start();

    fake.setHidden(false);
    expect(fake.pendingFrames).toBe(1);
    fake.setHidden(true);
    fake.setHidden(true);
    expect(fake.pendingFrames).toBe(0);
  });

  it('pauses and resumes from a fresh time reference, keeping the tick count', () => {
    const { fake, callbacks, loop } = setup();
    loop.start();
    fake.runFrame(0);
    fake.runFrame(STEP);

    loop.pause();
    expect(loop.status).toBe('paused');
    expect(fake.pendingFrames).toBe(0);

    loop.resume();
    expect(loop.status).toBe('running');
    expect(fake.pendingFrames).toBe(1);

    fake.runFrame(30_000);
    expect(callbacks.update).toHaveBeenCalledTimes(1);
    fake.runFrame(30_000 + STEP);
    expect(ticksOf(callbacks.update)).toEqual([0, 1]);
  });

  it('does not schedule a frame when the page becomes visible while paused', () => {
    const { fake, loop } = setup();
    loop.start();
    loop.pause();

    fake.setHidden(true);
    fake.setHidden(false);

    expect(fake.pendingFrames).toBe(0);
    expect(loop.status).toBe('paused');
  });

  it('stop cancels the pending frame and the visibility subscription; start begins again at 0', () => {
    const { fake, callbacks, loop } = setup();
    loop.start();
    fake.runFrame(0);
    fake.runFrame(STEP);
    expect(fake.visibilityListeners).toBe(1);

    loop.stop();
    expect(loop.status).toBe('stopped');
    expect(fake.pendingFrames).toBe(0);
    expect(fake.visibilityListeners).toBe(0);

    loop.start();
    fake.runFrame(5000);
    fake.runFrame(5000 + STEP);
    expect(ticksOf(callbacks.update)).toEqual([0, 0]);
    expect(loop.tick).toBe(1);
  });

  it('ignores a frame the host delivers after it was cancelled', () => {
    const { fake, callbacks, loop } = setup();
    loop.start();
    fake.runFrame(0);
    loop.stop();

    fake.runStaleFrame(STEP);

    expect(callbacks.update).not.toHaveBeenCalled();
    expect(callbacks.render).toHaveBeenCalledTimes(1);
    expect(fake.pendingFrames).toBe(0);
  });

  it('treats start, pause, resume and stop as no-ops outside their state', () => {
    const { fake, loop } = setup();

    loop.pause();
    loop.resume();
    loop.stop();
    expect(loop.status).toBe('stopped');
    expect(fake.pendingFrames).toBe(0);

    loop.start();
    loop.start();
    loop.resume();
    expect(fake.pendingFrames).toBe(1);
  });

  it('works with a host that cannot report visibility', () => {
    const fake = createFakeHost();
    const host: GameLoopHost = {
      requestFrame: (callback) => fake.host.requestFrame(callback),
      cancelFrame: (handle) => {
        fake.host.cancelFrame(handle);
      },
    };
    const update = vi.fn<GameLoopCallbacks['update']>();
    const loop = createGameLoop({ update, render: vi.fn() }, { host, hz: HZ });

    loop.start();
    fake.runFrame(0);
    fake.runFrame(STEP);
    loop.stop();

    expect(update).toHaveBeenCalledExactlyOnceWith(0, 1 / HZ);
  });
});
