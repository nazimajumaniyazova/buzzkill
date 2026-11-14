/**
 * The levels of a run (ADR-0017): a campaign of six, each a list of waves. A level plays by day
 * or by night, as the player chose or as an earlier level changed it, so a wave weighs the
 * enemies of the time's set by their place in it rather than naming them.
 */

/** One wave: enemies sent one after another at a steady pace. */
export interface WaveConfig {
  /** Enemies the wave sends. */
  readonly count: number;
  /** Ticks between two of them. */
  readonly intervalTicks: number;
  /**
   * The chance of each enemy of the time's set (`DAY_ENEMIES` or `NIGHT_ENEMIES`), in the set's
   * order. Without it the set's own weights apply.
   */
  readonly weights?: readonly [number, number, number];
}

export interface LevelConfig {
  readonly waves: readonly WaveConfig[];
  /** Ticks of calm before each wave, the first one included. */
  readonly breakTicks: number;
  /** Multiplies the speed of the level's enemies. */
  readonly speedScale: number;
  /** The sun sets or rises when the level is cleared: the next level plays at the other time. */
  readonly timeChangesAfter: boolean;
  /**
   * The queen (#152, `QUEEN`) ends the level: she arrives once every wave is sent and no enemy
   * is left, and the level is cleared when she is beaten. `health` is hers at normal difficulty.
   */
  readonly boss?: { readonly health: number };
}

/**
 * The campaign. The pace grows from an enemy every 1.5 s to one every 0.43 s, close to the peak
 * of the 2023 game, and the speed by a quarter. The first wave of all leaves out the third enemy
 * of each set; the last wave of the third and the sixth level sends only it.
 */
export const LEVELS = [
  {
    breakTicks: 120,
    speedScale: 1,
    timeChangesAfter: false,
    waves: [
      { count: 8, intervalTicks: 90, weights: [1, 1, 0] },
      { count: 10, intervalTicks: 75 },
    ],
  },
  {
    breakTicks: 120,
    speedScale: 1.05,
    timeChangesAfter: false,
    waves: [
      { count: 10, intervalTicks: 70 },
      { count: 12, intervalTicks: 60 },
    ],
  },
  {
    breakTicks: 120,
    speedScale: 1.1,
    timeChangesAfter: true,
    waves: [
      { count: 12, intervalTicks: 60 },
      { count: 14, intervalTicks: 50 },
      { count: 6, intervalTicks: 40, weights: [0, 0, 1] },
    ],
  },
  {
    breakTicks: 120,
    speedScale: 1.15,
    timeChangesAfter: false,
    waves: [
      { count: 12, intervalTicks: 55 },
      { count: 14, intervalTicks: 45 },
    ],
  },
  {
    breakTicks: 120,
    speedScale: 1.2,
    timeChangesAfter: false,
    waves: [
      { count: 14, intervalTicks: 45 },
      { count: 16, intervalTicks: 38 },
    ],
  },
  {
    breakTicks: 120,
    speedScale: 1.25,
    timeChangesAfter: false,
    waves: [
      { count: 16, intervalTicks: 40 },
      { count: 18, intervalTicks: 32 },
      { count: 8, intervalTicks: 26, weights: [0, 0, 1] },
    ],
  },
] as const satisfies readonly LevelConfig[];
