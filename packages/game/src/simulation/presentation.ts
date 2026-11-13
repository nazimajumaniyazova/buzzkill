/**
 * Values the renderer derives from the simulation without the simulation storing them. The 2023
 * classes kept animation frames and the background position as state; both follow from the tick,
 * so they stay out of the replayed state and cannot make two runs differ.
 */
import { RULES, WORLD } from '../config/rules';

/**
 * Horizontal offset of a background layer at `tick`, in [-width, 0]. The layer is drawn twice,
 * at the offset and one width to the right, so it tiles seamlessly. `speedModifier` makes far
 * layers slower than near ones (parallax).
 */
export function parallaxOffset(tick: number, width: number, speedModifier = 1): number {
  if (!(width > 0)) {
    throw new RangeError(`parallaxOffset: width must be positive, got ${String(width)}`);
  }
  const traveled = tick * RULES.scrollSpeed * speedModifier;
  const offset = -(traveled % width);
  // `-0` would be harmless on canvas; returning a plain 0 keeps tests and snapshots simple.
  return offset === 0 ? 0 : offset;
}

/** Sprite frame of an animation that started at `bornTick` and loops `frames` frames. */
export function animationFrame(
  tick: number,
  bornTick: number,
  frames: number,
  frameTicks: number,
): number {
  if (!Number.isInteger(frames) || frames < 1 || !Number.isInteger(frameTicks) || frameTicks < 1) {
    throw new RangeError('animationFrame: frames and frameTicks must be integers >= 1');
  }
  const elapsed = tick > bornTick ? tick - bornTick : 0;
  return Math.floor(elapsed / frameTicks) % frames;
}

/**
 * Whole seconds left of `ticks`, rounded up: the HUD shows 10 for the first second of a 10 s
 * effect and 1 for its last tick, and 0 only once it is over.
 */
export function secondsLeft(ticks: number): number {
  return ticks > 0 ? Math.ceil(ticks / WORLD.ticksPerSecond) : 0;
}
