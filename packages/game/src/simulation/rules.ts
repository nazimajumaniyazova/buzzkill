/**
 * The game rules as pure functions of numbers: no world, no RNG state, no side effects. Systems
 * call them; tests check them directly and with properties (#39).
 */
import { sin } from '@buzzkill/engine';

import type { IntRange, Range } from '../config/enemies';
import { RULES } from '../config/rules';

export type GameStatus = 'playing' | 'won' | 'lost';

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
 * The state of the run. A loss wins over a win in the same tick, the order the 2023 code checked
 * the hero before the projectiles.
 */
export function statusFor(score: number, lives: number): GameStatus {
  if (lives <= 0) {
    return 'lost';
  }
  return score > RULES.winningScore ? 'won' : 'playing';
}

/** Ammo after `tick`: one round back every `refillTicks` ticks, up to the maximum. */
export function ammoAfterTick(ammo: number, tick: number): number {
  const { refillTicks, max } = RULES.ammo;
  return tick > 0 && tick % refillTicks === 0 && ammo < max ? ammo + 1 : ammo;
}

/**
 * The spawn interval for `tick`: unchanged for the first 20 s, then shorter by one step per tick
 * until the minimum, as the 2023 code did (it reached the minimum within a fraction of a second).
 */
export function spawnIntervalAt(interval: number, tick: number): number {
  const { rampStartTick, rampStepTicks, minIntervalTicks } = RULES.spawn;
  if (tick < rampStartTick) {
    return interval;
  }
  const next = interval - rampStepTicks;
  return next > minIntervalTicks ? next : minIntervalTicks;
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
