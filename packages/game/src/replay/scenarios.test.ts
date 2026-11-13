import { describe, expect, it } from 'vitest';

import { type Replay, REPLAY_FORMAT_VERSION } from './format';
import { simulate } from './simulate';

/**
 * Short pinned runs in the form of ADR-0009: "seed X with inputs Y gives score Z and hash H
 * after N ticks". Each one is small enough to read: the inputs are written out, not generated.
 * The golden replays in `fixtures/replays` are the long versions. A changed value here means
 * the rules changed; the PR must say why (see the pull request template).
 */
const replay = (seed: number, inputs: number[], mode: 'day' | 'night' = 'day'): Replay => ({
  formatVersion: REPLAY_FORMAT_VERSION,
  gameVersion: 'test',
  seed,
  heroId: 'male',
  mode,
  difficulty: 'normal',
  inputs,
});

// Masks over moveUp (1), moveDown (2) and fire (4).
const UP = 1;
const DOWN = 2;
const FIRE = 4;

describe('pinned scenarios', () => {
  it('seed 1, standing still for 10 s', () => {
    expect(simulate(replay(1, []), { maxTicks: 600 })).toMatchInlineSnapshot(`
      {
        "hash": "39865fc0",
        "level": 1,
        "livesLeft": 4,
        "score": 0,
        "status": "playing",
        "ticks": 600,
      }
    `);
  });

  it('seed 7, one shot every half second for 20 s', () => {
    // Fire is down for one tick and up for 29, forty times.
    const inputs = [1, FIRE];
    for (let i = 1; i < 40; i += 1) {
      inputs.push(1, 0, 29, FIRE);
    }
    inputs.push(1, 0);

    expect(simulate(replay(7, inputs), { maxTicks: 1200 })).toMatchInlineSnapshot(`
      {
        "hash": "04e2418a",
        "level": 1,
        "livesLeft": 1,
        "score": 3,
        "status": "playing",
        "ticks": 1200,
      }
    `);
  });

  it('seed 42 at night, sweeping down and up; holding fire shoots only once', () => {
    const inputs = [1, DOWN | FIRE, 90, UP | FIRE, 90, DOWN, 90, UP];

    expect(simulate(replay(42, inputs, 'night'), { maxTicks: 900 })).toMatchInlineSnapshot(`
      {
        "hash": "a802c00d",
        "level": 1,
        "livesLeft": 4,
        "score": 0,
        "status": "playing",
        "ticks": 900,
      }
    `);
  });
});
