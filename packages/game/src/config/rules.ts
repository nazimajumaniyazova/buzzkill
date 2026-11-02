/**
 * World size, heroes and the numeric rules of the game. Every value comes from the 2023 code,
 * converted from per-frame and millisecond units to pixels per tick and ticks at 60 Hz.
 */

/**
 * The logical play area. The 2023 game used the window size, so the same run played differently
 * on different screens; a replay must not depend on the screen (ADR-0009), so the world has one
 * size and the renderer scales it to fit (letterboxed, see `computeCanvasFit`).
 */
export const WORLD = { width: 1280, height: 720, ticksPerSecond: 60 } as const;

export type HeroId = 'male' | 'female';

export interface HeroConfig {
  /** Collision box and drawing size. */
  readonly width: number;
  readonly height: number;
  /** Where projectiles leave the hero, from its top-left corner. */
  readonly muzzle: { readonly x: number; readonly y: number };
  readonly sprite: { readonly sheet: string };
}

/** Mike and Julie: the 2023 sprites scaled by 0.7 (and 0.8 for Julie's width). */
export const HEROES = {
  male: {
    width: 229 * 0.7,
    height: 226 * 0.7,
    muzzle: { x: 105, y: 90 },
    sprite: { sheet: 'male' },
  },
  female: {
    width: 172 * 0.8,
    height: 212 * 0.7,
    muzzle: { x: 105, y: 90 },
    sprite: { sheet: 'female' },
  },
} as const satisfies Record<HeroId, HeroConfig>;

export const RULES = {
  player: {
    start: { x: 20, y: 100 },
    /** Pixels per tick while a move action is held. */
    speed: 4,
    /** The hero may leave the screen by this share of its height at the top and the bottom. */
    overhangTop: 0.2,
    overhangBottom: 0.2,
  },
  lives: 5,
  ammo: { start: 20, max: 50, refillTicks: 12 },
  projectile: {
    width: 10,
    height: 3,
    speed: 4,
    /** Projectiles vanish at this share of the world width, before the right edge. */
    rangeRatio: 0.8,
  },
  spawn: {
    /** 1700 ms between enemies at the start. */
    intervalTicks: 102,
    /** After 20 s the interval shrinks by 100 ms per tick down to 400 ms, as in 2023. */
    rampStartTick: 1200,
    rampStepTicks: 6,
    minIntervalTicks: 24,
    /** Enemies spawn with their top in [0, height - hitbox height * this]. */
    bottomMarginRatio: 0.8,
  },
  explosion: {
    size: 200,
    /** 9 sprite frames, each shown for 4 ticks. */
    frames: 9,
    frameTicks: 4,
  },
  /** The background and explosions drift left by this many pixels per tick. */
  scrollSpeed: 1,
  /** Reaching more than this score wins the game. */
  winningScore: 100,
} as const;
