import { describe, test } from 'vitest';

import dayMale from '../../fixtures/replays/day-male-2026.json' with { type: 'json' };
import nightFemale from '../../fixtures/replays/night-female-2026.json' with { type: 'json' };
import { parseReplay, type Replay } from '../replay/format';
import { simulate } from '../replay/simulate';
import { createSimulation, type Simulation } from './simulation';

/**
 * Cost of the simulation (#44): one tick at a typical load, a three-minute run, and `simulate` on
 * the golden replays, which is the work the stage 8 server does to verify a score. Run with
 * `pnpm bench`.
 *
 * Under Vitest every import between modules goes through a getter of the module runner, so these
 * absolute numbers are about four times those of the bundled game (Vitest warns about it). That
 * does not affect comparing a branch with `main`, which pays the same overhead on both sides.
 * Bundled with Vite and run in Node 24 on 2026-11-05, the three-minute run took 89 ms and the
 * day golden replay 10 ms.
 */

const TICKS_PER_MINUTE = 60 * 60;
/**
 * CodSpeed's CPU simulation (ADR-0012) runs code many times slower than the CPU does: the
 * three-minute run alone took over two minutes there. Generous, so CI fails only on a real hang.
 */
const BENCH_TIMEOUT = 600_000;
const MOVE_UP = 1;
const MOVE_DOWN = 2;

/** Sweeps down and up over 4 s without firing: enemies fly past, and levels end as they leave. */
function sweep(tick: number): number {
  return tick % 240 < 120 ? MOVE_DOWN : MOVE_UP;
}

/**
 * A run that does not end early: the hero never runs out of lives. Real runs often end in the
 * first levels, too soon to measure the later ones, where enemies come every half second. This one
 * is in the fourth level after two minutes and in the sixth after three.
 */
function endlessRun(): Simulation {
  const simulation = createSimulation({ seed: 2026, heroId: 'male', mode: 'day' });
  simulation.state.lives = Number.MAX_SAFE_INTEGER;
  return simulation;
}

function play(simulation: Simulation, ticks: number, input: { down: number; pressed: number }) {
  for (let i = 0; i < ticks; i += 1) {
    const down = sweep(simulation.state.tick);
    input.pressed = down & ~input.down;
    input.down = down;
    simulation.step(input);
  }
}

function golden(value: unknown): Replay {
  const parsed = parseReplay(value);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return parsed.replay;
}

describe('simulation', () => {
  test('one tick at typical load', { timeout: BENCH_TIMEOUT }, async ({ bench }) => {
    // Two minutes in, in the fourth level, a few enemies are alive at any time.
    const simulation = endlessRun();
    const input = { down: 0, pressed: 0 };
    play(simulation, 2 * TICKS_PER_MINUTE, input);

    await bench('step at steady load', () => {
      play(simulation, 1, input);
    }).run();
  });

  test('three-minute run', { timeout: BENCH_TIMEOUT }, async ({ bench }) => {
    const input = { down: 0, pressed: 0 };

    await bench('10 800 ticks from a new run', () => {
      input.down = 0;
      play(endlessRun(), 3 * TICKS_PER_MINUTE, input);
    }).run();
  });

  test('simulate the golden replays', { timeout: BENCH_TIMEOUT }, async ({ bench }) => {
    const day = golden(dayMale);
    const night = golden(nightFemale);
    const maxTicks = 10 * TICKS_PER_MINUTE;

    await bench.compare(
      bench('simulate day-male-2026', () => {
        simulate(day, { maxTicks });
      }),
      bench('simulate night-female-2026', () => {
        simulate(night, { maxTicks });
      }),
    );
  });
});
