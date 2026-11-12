import { isRunOver } from '../simulation/rules';
import { createSimulation } from '../simulation/simulation';
import type { Replay } from './format';
import { type RunResult, runResultOf } from './result';

export interface SimulateOptions {
  /** The run stops here if it has not ended before. The server's CPU budget per replay. */
  readonly maxTicks: number;
}

/**
 * Plays a replay with no display, no DOM and no clock, in Node, Deno or a browser. It runs until
 * the run is won or lost or until `maxTicks`, and returns the result at that tick. A cleared level
 * goes straight on to the next: the screen between levels is never simulated (ADR-0017). A replay that
 * `createGame` recorded gives the same result as `game.result()` did at the same tick.
 *
 * The replay must come from `parseReplay` or a recorder; its type is the only check here.
 */
export function simulate(replay: Replay, options: SimulateOptions): RunResult {
  const { maxTicks } = options;
  if (!Number.isInteger(maxTicks) || maxTicks < 0) {
    throw new RangeError(`simulate: maxTicks must be an integer >= 0, got ${String(maxTicks)}`);
  }
  const simulation = createSimulation({
    seed: replay.seed,
    heroId: replay.heroId,
    mode: replay.mode,
  });
  const { state } = simulation;
  const { inputs } = replay;

  // `pressed` follows from consecutive masks exactly as in `createGame`, so it is not stored.
  const input = { down: 0, pressed: 0 };
  let nextIndex = 0;
  let nextChangeTick = inputs.length > 0 ? (inputs[0] as number) : Infinity;

  for (let tick = 1; tick <= maxTicks && !isRunOver(state.status); tick += 1) {
    let down = input.down;
    if (tick === nextChangeTick) {
      down = inputs[nextIndex + 1] as number;
      nextIndex += 2;
      nextChangeTick = nextIndex < inputs.length ? tick + (inputs[nextIndex] as number) : Infinity;
    }
    input.pressed = down & ~input.down;
    input.down = down;
    simulation.step(input);
  }
  return runResultOf(state);
}
