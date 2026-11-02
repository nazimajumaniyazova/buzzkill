/**
 * Fixed-timestep accumulator (ADR-0009). Real time arrives in frames of any length; the
 * simulation advances only in whole ticks of one constant length. Time that does not fill a tick
 * is carried over to the next frame and reported as `alpha`, so the renderer can interpolate
 * between the previous and the current tick instead of stuttering.
 *
 * Frame timestamps are floating-point numbers, so two frames exactly one step apart can count as
 * 0 and then 2 ticks through rounding alone. That is expected: `alpha` carries the remainder, and
 * interpolating with it is what keeps motion smooth whatever the frame-to-tick ratio is.
 */

export interface FixedTimestepOptions {
  /** Simulation ticks per second. Default 60. */
  readonly hz?: number;
  /**
   * Most ticks one `advance` may produce. A frame that arrives later than this many ticks (a
   * stalled tab, a debugger pause, a long GC) has the rest of its backlog discarded instead of
   * simulated. Without the cap every slow frame would create more work for the next one, the
   * spiral of death. Default 5: a backlog of up to 83 ms at 60 Hz is still caught up.
   */
  readonly maxTicksPerAdvance?: number;
}

/** What one frame has to do, as computed by `FixedTimestep.advance`. */
export interface FrameAdvance {
  /** Whole ticks to simulate before rendering this frame. */
  readonly ticks: number;
  /** Fraction in [0, 1) of the next tick that has already elapsed: the interpolation factor. */
  readonly alpha: number;
  /** Backlog in milliseconds discarded by the cap; 0 on a frame that kept up. */
  readonly droppedMs: number;
}

export interface FixedTimestep {
  /** Length of one tick in milliseconds (1000 / hz). */
  readonly stepMs: number;
  /** Length of one tick in seconds (1 / hz): the constant `dt` the simulation sees. */
  readonly stepSeconds: number;
  /**
   * Adds the real time elapsed since the previous frame and returns what this frame has to do.
   * The returned object is reused between calls so a frame allocates nothing; read it before the
   * next `advance`. Negative elapsed time (a clock going backwards) counts as zero.
   *
   * @throws RangeError when `elapsedMs` is NaN or infinite: that is a caller bug, and adding it
   *   would poison the accumulator for good.
   */
  advance(elapsedMs: number): FrameAdvance;
  /** Forgets the carried-over time, so that nothing is simulated for a pause. */
  reset(): void;
}

export function createFixedTimestep(options: FixedTimestepOptions = {}): FixedTimestep {
  const hz = options.hz ?? 60;
  const maxTicks = options.maxTicksPerAdvance ?? 5;
  if (!Number.isFinite(hz) || hz <= 0) {
    throw new RangeError(`createFixedTimestep: hz must be a positive number, got ${String(hz)}`);
  }
  if (!Number.isInteger(maxTicks) || maxTicks < 1) {
    throw new RangeError(
      `createFixedTimestep: maxTicksPerAdvance must be an integer >= 1, got ${String(maxTicks)}`,
    );
  }

  const stepMs = 1000 / hz;
  let accumulator = 0;
  // One mutable result for the lifetime of the stepper: the hot loop must not allocate.
  const result = { ticks: 0, alpha: 0, droppedMs: 0 };

  return {
    stepMs,
    stepSeconds: 1 / hz,
    advance(elapsedMs: number): FrameAdvance {
      if (!Number.isFinite(elapsedMs)) {
        throw new RangeError(`advance: elapsed time must be finite, got ${String(elapsedMs)}`);
      }
      if (elapsedMs > 0) {
        accumulator += elapsedMs;
      }

      let ticks = 0;
      while (accumulator >= stepMs && ticks < maxTicks) {
        accumulator -= stepMs;
        ticks += 1;
      }
      let droppedMs = 0;
      if (accumulator >= stepMs) {
        droppedMs = accumulator;
        accumulator = 0;
      }

      result.ticks = ticks;
      result.alpha = accumulator / stepMs;
      result.droppedMs = droppedMs;
      return result;
    },
    reset(): void {
      accumulator = 0;
    },
  };
}
