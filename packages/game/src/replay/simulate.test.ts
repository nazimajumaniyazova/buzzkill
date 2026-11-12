// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import { createSimulation } from '../simulation/simulation';
import type { Replay } from './format';
import { createReplayRecorder } from './recorder';
import { hashGameState, runResultOf } from './result';
import { simulate } from './simulate';

const META = { gameVersion: 'test', heroId: 'male', mode: 'day', difficulty: 'normal' } as const;

/** Plays `masks` (one per tick) by hand and records them; returns the replay and the end state. */
function playAndRecord(seed: number, masks: readonly number[]) {
  const simulation = createSimulation({ seed, heroId: META.heroId, mode: META.mode });
  const recorder = createReplayRecorder({ ...META, seed });
  let previous = 0;
  for (const down of masks) {
    if (simulation.state.status !== 'playing') {
      break;
    }
    recorder.recordInput(simulation.state.tick + 1, down);
    simulation.step({ down, pressed: down & ~previous });
    previous = down;
  }
  return { replay: recorder.replay(), state: simulation.state };
}

describe('simulate', () => {
  it('gives the result of playing the same inputs by hand', () => {
    const masks = Array.from(
      { length: 1200 },
      (_, tick) => (tick % 90 < 45 ? 2 : 1) | (tick % 15 === 0 ? 4 : 0),
    );
    const { replay, state } = playAndRecord(9, masks);

    const result = simulate(replay, { maxTicks: masks.length });

    expect(result).toEqual(runResultOf(state));
    expect(result.ticks).toBe(1200);
    expect(result.level).toBe(1);
    expect(result.hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('stops at maxTicks', () => {
    const replay: Replay = { formatVersion: 2, ...META, seed: 1, inputs: [] };

    expect(simulate(replay, { maxTicks: 10 }).ticks).toBe(10);
  });

  it('stops at the tick the run is lost', () => {
    // Idle at the start position, the hero is eventually hit five times.
    const replay: Replay = { formatVersion: 2, ...META, seed: 1, inputs: [] };

    const result = simulate(replay, { maxTicks: 60 * 60 * 10 });

    expect(result.status).toBe('lost');
    expect(result.livesLeft).toBe(0);
    expect(result.ticks).toBeLessThan(60 * 60 * 10);
    expect(simulate(replay, { maxTicks: result.ticks })).toEqual(result);
  });

  it('ignores changes recorded after the last simulated tick', () => {
    const replay: Replay = { formatVersion: 2, ...META, seed: 1, inputs: [50, 4] };

    expect(simulate(replay, { maxTicks: 49 })).toEqual(
      simulate({ ...replay, inputs: [] }, { maxTicks: 49 }),
    );
  });

  it('accepts 0 ticks and rejects a maxTicks that is not a whole number', () => {
    const replay: Replay = { formatVersion: 2, ...META, seed: 1, inputs: [] };

    expect(simulate(replay, { maxTicks: 0 }).ticks).toBe(0);
    expect(() => simulate(replay, { maxTicks: -1 })).toThrow(RangeError);
    expect(() => simulate(replay, { maxTicks: 1.5 })).toThrow(RangeError);
  });

  it('hashes different states differently', () => {
    const a = createSimulation({ seed: 1, ...META });
    const b = createSimulation({ seed: 1, ...META });
    expect(hashGameState(a.state)).toBe(hashGameState(b.state));

    b.step({ down: 1, pressed: 1 });
    a.step({ down: 0, pressed: 0 });

    expect(hashGameState(a.state)).not.toBe(hashGameState(b.state));
  });

  test.prop([
    fc.nat({ max: 0xff_ff_ff_ff }),
    fc.array(fc.nat({ max: 7 }), { minLength: 1, maxLength: 1500 }),
  ])('replays its own recording: simulate twice gives one hash', (seed, masks) => {
    const { replay, state } = playAndRecord(seed, masks);

    const first = simulate(replay, { maxTicks: state.tick });

    expect(first.hash).toBe(hashGameState(state));
    expect(simulate(replay, { maxTicks: state.tick })).toEqual(first);
  });
});
