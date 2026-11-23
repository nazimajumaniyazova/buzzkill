import type { ActionInput, InputSnapshot } from '@buzzkill/engine';

import { GAME_ACTIONS, type GameAction } from '../actions';
import type { Replay } from './format';

/**
 * The input of a replay (#219): what the player held at each tick of the recorded run, for
 * `createGame` to play the run again on screen with the same engine, sounds and pictures. Each
 * `sample()` is the next tick, and `createGame` samples once per simulated tick, never during a
 * pause or between levels, so a replay watched with pauses plays the same ticks as `simulate`.
 *
 * Nobody plays a replay by hand: `press` and `release` do nothing, so the keyboard and touch
 * sources can stay attached. `reset` starts over from the first tick. The replay must come from
 * `parseReplay` or a recorder.
 */
export function createReplayInput(replay: Replay): ActionInput<GameAction> {
  const { inputs } = replay;
  const snapshot = { down: 0, pressed: 0, released: 0 };
  let tick = 0;
  let nextIndex = 0;
  let nextChangeTick = 0;

  const rewind = (): void => {
    tick = 0;
    nextIndex = 0;
    nextChangeTick = inputs.length > 0 ? (inputs[0] as number) : Infinity;
    snapshot.down = 0;
    snapshot.pressed = 0;
    snapshot.released = 0;
  };
  rewind();

  return {
    actions: [...GAME_ACTIONS],
    bit: (action) => 1 << GAME_ACTIONS.indexOf(action),
    press: () => undefined,
    release: () => undefined,
    releaseSources: () => undefined,
    isHeld: () => false,
    // The same reading of the changes as `simulate`: a mask holds until the next change. The
    // indexes are in range: `parseReplay` lets only whole pairs through.
    sample(): InputSnapshot {
      tick += 1;
      const previous = snapshot.down;
      let down = previous;
      if (tick === nextChangeTick) {
        down = inputs[nextIndex + 1] as number;
        nextIndex += 2;
        nextChangeTick =
          nextIndex < inputs.length ? tick + (inputs[nextIndex] as number) : Infinity;
      }
      snapshot.down = down;
      snapshot.pressed = down & ~previous;
      snapshot.released = previous & ~down;
      return snapshot;
    },
    reset: rewind,
  };
}
