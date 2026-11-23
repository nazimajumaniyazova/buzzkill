// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import { GAME_ACTIONS } from '../actions';
import { type Replay, REPLAY_ACTION_MASK } from './format';
import { createReplayRecorder } from './recorder';
import { createReplayInput } from './replay-input';

const META = { gameVersion: 'test', heroId: 'male', mode: 'day', difficulty: 'normal' } as const;

function replayOf(inputs: readonly number[]): Replay {
  return { formatVersion: 3, ...META, seed: 1, daily: null, inputs };
}

/** The snapshots of `count` samples, copied: the input reuses one object. */
function samples(input: ReturnType<typeof createReplayInput>, count: number) {
  return Array.from({ length: count }, () => ({ ...input.sample() }));
}

describe('createReplayInput', () => {
  it('uses the actions of the game in their order', () => {
    const input = createReplayInput(replayOf([]));

    expect(input.actions).toEqual(GAME_ACTIONS);
    expect(input.bit('fire')).toBe(1 << GAME_ACTIONS.indexOf('fire'));
  });

  it('gives the masks of the replay one tick after another', () => {
    // Fire is down from tick 3 and up again from tick 5.
    const input = createReplayInput(replayOf([3, 4, 2, 0]));

    expect(samples(input, 6)).toEqual([
      { down: 0, pressed: 0, released: 0 },
      { down: 0, pressed: 0, released: 0 },
      { down: 4, pressed: 4, released: 0 },
      { down: 4, pressed: 0, released: 0 },
      { down: 0, pressed: 0, released: 4 },
      { down: 0, pressed: 0, released: 0 },
    ]);
  });

  it('ignores the player: nobody plays a replay by hand', () => {
    const input = createReplayInput(replayOf([]));

    input.press('fire', 'key:Space');
    input.press('pause', 'key:Escape');

    expect(input.isHeld('fire')).toBe(false);
    expect(input.sample().down).toBe(0);
    input.release('fire', 'key:Space');
    input.releaseSources('key:');
    expect(input.sample().down).toBe(0);
  });

  it('starts over from the first tick on reset', () => {
    const input = createReplayInput(replayOf([1, 4]));
    samples(input, 3);

    input.reset();

    expect(input.sample()).toEqual({ down: 4, pressed: 4, released: 0 });
  });

  const masks = fc.array(fc.integer({ min: 0, max: REPLAY_ACTION_MASK }), { maxLength: 400 });

  test.prop([masks])('gives back every mask a recorder recorded, at its tick', (downs) => {
    const recorder = createReplayRecorder({ ...META, seed: 1 });
    downs.forEach((down, index) => {
      recorder.recordInput(index + 1, down & REPLAY_ACTION_MASK);
    });
    const input = createReplayInput(recorder.replay());

    let previous = 0;
    for (const down of downs) {
      const expected = down & REPLAY_ACTION_MASK;
      expect(input.sample()).toEqual({
        down: expected,
        pressed: expected & ~previous,
        released: previous & ~expected,
      });
      previous = expected;
    }
    // After the last change the mask holds.
    expect(input.sample().down).toBe(previous);
  });
});
