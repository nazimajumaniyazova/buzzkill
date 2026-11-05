import type { GameMode } from '../config/enemies';
import type { HeroId } from '../config/rules';
import { type Replay, REPLAY_ACTION_MASK, REPLAY_FORMAT_VERSION } from './format';

export interface ReplayRecorderOptions {
  readonly gameVersion: string;
  readonly seed: number;
  readonly heroId: HeroId;
  readonly mode: GameMode;
}

export interface ReplayRecorder {
  /**
   * Records the actions down in simulation tick `tick` (the first tick is 1). Ticks must grow;
   * only a mask that differs from the previous one is stored. `down` must not contain `pause`.
   */
  recordInput(tick: number, down: number): void;
  /** The replay recorded so far, as a new object. */
  replay(): Replay;
}

export function createReplayRecorder(options: ReplayRecorderOptions): ReplayRecorder {
  const inputs: number[] = [];
  let lastTick = 0;
  let lastChangeTick = 0;
  let lastMask = 0;

  return {
    recordInput(tick, down) {
      if (!Number.isInteger(tick) || tick <= lastTick) {
        throw new RangeError(
          `recordInput: tick must be an integer above ${String(lastTick)}, got ${String(tick)}`,
        );
      }
      if (!Number.isInteger(down) || down < 0 || (down & ~REPLAY_ACTION_MASK) !== 0) {
        throw new RangeError(
          `recordInput: mask ${String(down)} has bits outside the replay actions`,
        );
      }
      lastTick = tick;
      if (down === lastMask) {
        return;
      }
      inputs.push(tick - lastChangeTick, down);
      lastChangeTick = tick;
      lastMask = down;
    },
    replay() {
      return {
        formatVersion: REPLAY_FORMAT_VERSION,
        gameVersion: options.gameVersion,
        seed: options.seed,
        heroId: options.heroId,
        mode: options.mode,
        inputs: inputs.slice(),
      };
    },
  };
}
