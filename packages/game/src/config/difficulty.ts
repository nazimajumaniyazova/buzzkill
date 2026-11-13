import { RULES } from './rules';

/** The difficulties a run can take, from the settings (#110), easiest first. */
export const DIFFICULTY_IDS = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTY_IDS)[number];

/**
 * How a difficulty bends the numbers of the levels and of the hero (#155). Balancing the game is
 * editing these, not code; each is a factor or an offset on the data of `LEVELS` and `RULES`.
 */
export interface DifficultyConfig {
  /** Multiplies the enemies' speed, on top of the level's factor. */
  readonly enemySpeed: number;
  /** Multiplies the ticks between enemies and the calm before each wave: above 1 is calmer. */
  readonly pace: number;
  /** Added to each enemy's lives, and so to its score; an enemy keeps at least one life. */
  readonly enemyLives: number;
  /** The hero's lives at the start of a run. */
  readonly lives: number;
  /** The hero's rounds at the start, and the most the refill gives back. */
  readonly ammo: { readonly start: number; readonly max: number };
}

/**
 * Normal plays the numbers of the 2023 game. Easy and hard move every number the same way, so
 * no difficulty is easier in one respect and harder in another; a test checks it.
 */
export const DIFFICULTIES = {
  easy: { enemySpeed: 0.8, pace: 1.3, enemyLives: -1, lives: 7, ammo: { start: 30, max: 60 } },
  normal: {
    enemySpeed: 1,
    pace: 1,
    enemyLives: 0,
    lives: RULES.lives,
    ammo: { start: RULES.ammo.start, max: RULES.ammo.max },
  },
  hard: { enemySpeed: 1.2, pace: 0.8, enemyLives: 1, lives: 3, ammo: { start: 15, max: 40 } },
} as const satisfies Record<Difficulty, DifficultyConfig>;
