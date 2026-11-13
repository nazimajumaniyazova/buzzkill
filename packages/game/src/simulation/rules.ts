/**
 * The game rules as pure functions of numbers: no world, no RNG state, no side effects. Systems
 * call them; tests check them directly and with properties (#39).
 */
import { sin } from '@buzzkill/engine';

import type { GameMode, IntRange, Range } from '../config/enemies';
import { type LevelConfig, LEVELS } from '../config/levels';
import { RULES } from '../config/rules';

/**
 * Where a run stands. `levelCleared` lasts one tick in the simulation, the next one starts the
 * next level; the shell holds the game there for the screen between levels (ADR-0017).
 */
export type GameStatus = 'playing' | 'levelCleared' | 'won' | 'lost';

/** Whether the run is over, won or lost: nothing changes it any more. */
export function isRunOver(status: GameStatus): boolean {
  return status === 'won' || status === 'lost';
}

/** Health after one hit. Never negative. */
export function healthAfterHit(health: number): number {
  return health > 1 ? health - 1 : 0;
}

/** Lives after the hero is hit. Never negative. */
export function livesAfterHit(lives: number): number {
  return lives > 1 ? lives - 1 : 0;
}

/** Score after destroying an enemy worth `value`. A negative value never lowers the score. */
export function scoreAfterKill(score: number, value: number): number {
  return value > 0 ? score + value : score;
}

/**
 * The state of the run after a tick. A loss wins over a cleared level in the same tick, the order
 * the 2023 code checked the hero before the projectiles. Clearing the last level wins the run.
 */
export function statusFor(lives: number, levelDone: boolean, lastLevel: boolean): GameStatus {
  if (lives <= 0) {
    return 'lost';
  }
  if (!levelDone) {
    return 'playing';
  }
  return lastLevel ? 'won' : 'levelCleared';
}

/** The other time of day: the sun sets or rises between levels. */
export function otherTime(mode: GameMode): GameMode {
  return mode === 'day' ? 'night' : 'day';
}

/** The time of day of the level after `level`, which was played at `mode` (ADR-0017). */
export function timeAfterLevel(level: number, mode: GameMode): GameMode {
  const levels: readonly LevelConfig[] = LEVELS;
  return levels[level - 1]?.timeChangesAfter === true ? otherTime(mode) : mode;
}

/** Ammo after `tick`: one round back every `refillTicks` ticks, up to `max`. */
export function ammoAfterTick(ammo: number, tick: number, max: number = RULES.ammo.max): number {
  const { refillTicks } = RULES.ammo;
  return tick > 0 && tick % refillTicks === 0 && ammo < max ? ammo + 1 : ammo;
}

/**
 * `value` plus `gain`, up to `cap`: what a power-up gives (#151). A value already above the cap
 * stays where it is, so collecting never takes anything away.
 */
export function addCapped(value: number, gain: number, cap: number): number {
  if (value >= cap) {
    return value;
  }
  const next = value + gain;
  return next < cap ? next : cap;
}

/** A number of ticks at a difficulty's `pace`: a whole tick, never below one (#155). */
export function paced(ticks: number, pace: number): number {
  const scaled = Math.round(ticks * pace);
  return scaled > 1 ? scaled : 1;
}

/** An enemy's lives with a difficulty's offset: it always keeps at least one (#155). */
export function enemyLivesWith(lives: number, offset: number): number {
  const total = lives + offset;
  return total > 1 ? total : 1;
}

/** Vertical offset of a wave for one tick. Uses the engine's deterministic `sin`. */
export function waveStep(amplitude: number, angle: number): number {
  return amplitude * sin(angle);
}

/** A value in `range` for a uniform `roll` in [0, 1). */
export function valueInRange(range: Range, roll: number): number {
  return range.min + roll * (range.max - range.min);
}

/** A whole number in the inclusive `range` for a uniform `roll` in [0, 1). */
export function intInRange(range: IntRange, roll: number): number {
  return range.min + Math.floor(roll * (range.max - range.min + 1));
}

/**
 * Index of the item a uniform `roll` in [0, 1) selects, each item with a chance proportional to
 * its weight. The 2023 split of 0.3, 0.3 and 0.4 is weights 3, 3 and 4.
 *
 * @throws RangeError when there is nothing to pick or the weights do not add up to more than 0.
 */
export function pickWeighted(weights: readonly number[], roll: number): number {
  let total = 0;
  for (const weight of weights) {
    total += weight > 0 ? weight : 0;
  }
  if (!(total > 0)) {
    throw new RangeError('pickWeighted: need at least one positive weight');
  }
  let threshold = roll * total;
  for (let index = 0; index < weights.length; index += 1) {
    const weight = weights[index] ?? 0;
    if (weight <= 0) {
      continue;
    }
    if (threshold < weight) {
      return index;
    }
    threshold -= weight;
  }
  // Rounding can leave `threshold` a hair above the last weight: the last positive item wins.
  let last = weights.length - 1;
  while ((weights[last] ?? 0) <= 0) {
    last -= 1;
  }
  return last;
}
