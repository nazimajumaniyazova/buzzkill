/**
 * Enemy kinds as data (#38). The 2023 code had six classes, `Enemy1..3` for day and
 * `EnemyNight1..3` for night, that differed only in the numbers collected here. A kind is now one
 * object; the spawn system reads it, and day and night are two lists, not two class families.
 *
 * Units follow the simulation: lengths in world pixels, speeds in pixels per tick, times in ticks
 * at 60 Hz. The 2023 code moved enemies once per animation frame, which at 60 Hz is the same
 * number per tick.
 */

/**
 * A uniform random range from `min` to `max`. A roll just below 1 can round to exactly `max`, so
 * treat both ends as reachable.
 */
export interface Range {
  readonly min: number;
  readonly max: number;
}

/** An inclusive range of whole numbers. */
export interface IntRange {
  readonly min: number;
  readonly max: number;
}

export interface EnemyConfig {
  /** Stable name, used for the sprite and in tests; never shown to players. */
  readonly id: string;
  /** Relative spawn chance within its set. */
  readonly weight: number;
  /** Collision box, from the top-left corner of the entity. */
  readonly hitbox: { readonly width: number; readonly height: number };
  /** Horizontal speed to the left, in pixels per tick. */
  readonly speed: Range;
  /** Hits it takes; also its score when destroyed. */
  readonly lives: IntRange;
  /** Vertical wave: `y += amplitude * sin(angle)` with `angle += angleSpeed` every tick. */
  readonly wave: { readonly amplitude: Range; readonly angleSpeed: Range };
  /**
   * Drawing data for the renderer; the simulation never reads it. The frames and their pace come
   * with the art, from the generated asset manifest (ADR-0016).
   */
  readonly sprite: {
    /** The enemy's sprite in `@buzzkill/art`. */
    readonly sheet: string;
    /** The art's frame size, twice the world's pixels; the hitbox is half of it. */
    readonly frameWidth: number;
    readonly frameHeight: number;
  };
}

/** Numbers every 2023 enemy shared: `Math.random() * -3 - 1.5`, `floor(random * 5 + 1)` and so on. */
const SHARED = {
  speed: { min: 1.5, max: 4.5 },
  lives: { min: 1, max: 5 },
  wave: { amplitude: { min: 0, max: 2 }, angleSpeed: { min: 0, max: 0.5 } },
} as const;

/**
 * The hitbox was half the sprite frame for every kind but `EnemyNight3`, whose full-size box
 * was twice as large as its drawing; it is half the frame here like the others.
 */
function halfFrame(frameWidth: number, frameHeight: number) {
  return { width: frameWidth * 0.5, height: frameHeight * 0.5 };
}

export const DAY_ENEMIES = [
  {
    id: 'day-1',
    weight: 3,
    hitbox: halfFrame(273, 273),
    ...SHARED,
    sprite: { sheet: 'beetle', frameWidth: 273, frameHeight: 273 },
  },
  {
    id: 'day-2',
    weight: 3,
    hitbox: halfFrame(253, 207),
    ...SHARED,
    sprite: { sheet: 'wasp', frameWidth: 253, frameHeight: 207 },
  },
  {
    id: 'day-3',
    weight: 4,
    hitbox: halfFrame(266, 207),
    ...SHARED,
    sprite: { sheet: 'dragonfly', frameWidth: 266, frameHeight: 207 },
  },
] as const satisfies readonly EnemyConfig[];

export const NIGHT_ENEMIES = [
  {
    id: 'night-bat',
    weight: 3,
    hitbox: halfFrame(266, 188),
    ...SHARED,
    sprite: { sheet: 'moth', frameWidth: 266, frameHeight: 188 },
  },
  {
    id: 'night-raven',
    weight: 3,
    hitbox: halfFrame(271, 194),
    ...SHARED,
    sprite: { sheet: 'firefly', frameWidth: 271, frameHeight: 194 },
  },
  {
    id: 'night-ghost',
    weight: 4,
    hitbox: halfFrame(238, 167),
    ...SHARED,
    sprite: { sheet: 'mosquito', frameWidth: 238, frameHeight: 167 },
  },
] as const satisfies readonly EnemyConfig[];

export type GameMode = 'day' | 'night';

/** The enemy set of each mode. */
export const ENEMY_SETS: Readonly<Record<GameMode, readonly EnemyConfig[]>> = {
  day: DAY_ENEMIES,
  night: NIGHT_ENEMIES,
};
