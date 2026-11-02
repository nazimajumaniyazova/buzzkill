import { createFixedTimestep, type FixedTimestepOptions } from './fixed-timestep';

/**
 * The services the loop needs from its surroundings. `createBrowserHost` provides them from
 * `requestAnimationFrame` and the Page Visibility API; tests provide a fake and drive frames by
 * hand.
 */
export interface GameLoopHost {
  /** Schedules `callback` for the next display frame, with that frame's timestamp in ms. */
  requestFrame(callback: (timeMs: number) => void): number;
  cancelFrame(handle: number): void;
  /**
   * Reports page visibility changes; the loop runs no frames while the page is hidden. Returns
   * the function that removes the listener. Hosts without a document (workers) may omit it.
   */
  subscribeVisibility?(listener: (hidden: boolean) => void): () => void;
}

export interface GameLoopCallbacks {
  /** Advances the simulation by exactly one tick. `tick` counts from 0; `stepSeconds` is constant. */
  update(tick: number, stepSeconds: number): void;
  /** Draws once per displayed frame. `alpha` in [0, 1) is how far the next tick already is. */
  render(alpha: number): void;
  /** A frame discarded `droppedMs` of backlog; see `FixedTimestepOptions.maxTicksPerAdvance`. */
  onBacklogDropped?(droppedMs: number): void;
}

export type GameLoopStatus = 'stopped' | 'running' | 'paused';

export interface GameLoop {
  readonly status: GameLoopStatus;
  /** True while the host reports the page as hidden. No frame runs then, whatever the status. */
  readonly hidden: boolean;
  /** Ticks simulated since `start`. */
  readonly tick: number;
  /** Begins from tick 0. Does nothing unless the loop is stopped. */
  start(): void;
  /** Holds the simulation and stops rendering; `resume` continues from the same tick. */
  pause(): void;
  /** Continues a paused loop. The paused time is never simulated. */
  resume(): void;
  /** Cancels the pending frame and releases the visibility subscription. */
  stop(): void;
}

export interface GameLoopOptions extends FixedTimestepOptions {
  readonly host: GameLoopHost;
}

/**
 * Fixed-step game loop: one `update` per simulation tick, one `render` per displayed frame
 * (ADR-0009). Every way back into ticking (start, resume, the page becoming visible again) begins
 * from a fresh time reference, so time spent paused or hidden is never simulated as a burst.
 */
export function createGameLoop(callbacks: GameLoopCallbacks, options: GameLoopOptions): GameLoop {
  const { host, ...timestepOptions } = options;
  const timestep = createFixedTimestep(timestepOptions);

  let status: GameLoopStatus = 'stopped';
  let hidden = false;
  let tick = 0;
  let frameHandle: number | null = null;
  let previousFrameMs: number | null = null;
  let unsubscribeVisibility: (() => void) | null = null;

  const onFrame = (timeMs: number): void => {
    frameHandle = null;
    if (status !== 'running' || hidden) {
      // A host may still deliver a frame that was cancelled a moment ago.
      return;
    }

    const elapsedMs = previousFrameMs === null ? 0 : timeMs - previousFrameMs;
    previousFrameMs = timeMs;
    const frame = timestep.advance(elapsedMs);

    for (let i = 0; i < frame.ticks; i += 1) {
      callbacks.update(tick, timestep.stepSeconds);
      tick += 1;
    }
    if (frame.droppedMs > 0) {
      callbacks.onBacklogDropped?.(frame.droppedMs);
    }
    callbacks.render(frame.alpha);
    schedule();
  };

  const schedule = (): void => {
    if (status === 'running' && !hidden && frameHandle === null) {
      frameHandle = host.requestFrame(onFrame);
    }
  };

  const cancelFrame = (): void => {
    if (frameHandle !== null) {
      host.cancelFrame(frameHandle);
      frameHandle = null;
    }
  };

  /** Resumes ticking with the next frame as the new time reference. */
  const wake = (): void => {
    previousFrameMs = null;
    schedule();
  };

  const onVisibilityChange = (nowHidden: boolean): void => {
    if (nowHidden === hidden) {
      return;
    }
    hidden = nowHidden;
    if (hidden) {
      cancelFrame();
    } else {
      wake();
    }
  };

  return {
    get status() {
      return status;
    },
    get hidden() {
      return hidden;
    },
    get tick() {
      return tick;
    },
    start(): void {
      if (status !== 'stopped') {
        return;
      }
      status = 'running';
      tick = 0;
      timestep.reset();
      unsubscribeVisibility = host.subscribeVisibility?.(onVisibilityChange) ?? null;
      wake();
    },
    pause(): void {
      if (status !== 'running') {
        return;
      }
      status = 'paused';
      cancelFrame();
    },
    resume(): void {
      if (status !== 'paused') {
        return;
      }
      status = 'running';
      wake();
    },
    stop(): void {
      if (status === 'stopped') {
        return;
      }
      status = 'stopped';
      cancelFrame();
      unsubscribeVisibility?.();
      unsubscribeVisibility = null;
    },
  };
}
