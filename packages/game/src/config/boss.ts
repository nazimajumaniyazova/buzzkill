/**
 * The boss of #152 as data: the queen wasp who ends every level that names her
 * (`LevelConfig.boss`). The owner approved her look, phases and attacks on 2026-11-13.
 *
 * Units follow the simulation: lengths in world pixels, speeds in pixels per tick, times in ticks
 * at 60 Hz. A difficulty scales her speeds by `enemySpeed`, her times by `pace` and her health by
 * `bossHealth` (#155).
 */

/** How she moves and attacks in one phase of her fight. */
export interface BossPhaseConfig {
  /** Pixels per tick she glides toward the height she picked. */
  readonly moveSpeed: number;
  /** Ticks between two picks of a new height. */
  readonly pickHeightTicks: number;
  /** Ticks between two attacks. Volleys and fans take turns, a volley first. */
  readonly attackTicks: number;
  /** The vertical speeds of a fan's stings, top to bottom. */
  readonly fan: readonly number[];
  /** Ticks between two broods. */
  readonly broodTicks: number;
}

export interface BossConfig {
  /** Collision box, from the top-left corner. */
  readonly hitbox: { readonly width: number; readonly height: number };
  /** Where her left edge stops: within the reach of the hero's shots. */
  readonly postX: number;
  /** Pixels per tick she flies in from the right edge, when she arrives and after a charge. */
  readonly enterSpeed: number;
  /** She is enraged once her health is at most `part / of` of the most she had. */
  readonly rage: { readonly part: number; readonly of: number };
  readonly sting: {
    readonly width: number;
    readonly height: number;
    /** Pixels per tick to the left. */
    readonly speed: number;
    /** The steepest a volley aims: the most pixels a sting climbs or falls per tick. */
    readonly maxSlope: number;
    /** Where a new sting's box starts, from her top-left: just ahead of the tip of her sting. */
    readonly muzzle: { readonly x: number; readonly y: number };
  };
  /** A volley: stings one after another, each aimed at the hero when it leaves. */
  readonly volley: { readonly count: number; readonly gapTicks: number };
  /** Enemies of the time's set that a brood sends from the right edge. */
  readonly broodCount: number;
  readonly attacking: BossPhaseConfig;
  readonly enraged: BossPhaseConfig & {
    /** Ticks of her rage before she winds up a charge. */
    readonly chargeAfterTicks: number;
  };
  readonly charge: {
    /** Ticks she shakes in place before she charges: the hero's warning. */
    readonly windupTicks: number;
    /** Pixels per tick to the left. */
    readonly speed: number;
  };
  readonly defeat: {
    /** Ticks from her defeat until she is gone. */
    readonly ticks: number;
    /** Ticks between two explosions on her while she falls. */
    readonly explosionTicks: number;
    /** Pixels per tick she sinks. */
    readonly sinkSpeed: number;
  };
  /**
   * Drawing data for the renderer; the simulation never reads it. Her rage is an overlay drawn
   * over her frame of the same number.
   */
  readonly sprite: {
    readonly sheet: string;
    readonly rage: string;
    readonly sting: string;
    /** The art's frame size, twice the world's pixels; the hitbox is half of it. */
    readonly frameWidth: number;
    readonly frameHeight: number;
  };
}

/**
 * The queen. Her post leaves her left edge at 940, within the 1024 pixels the hero's shots reach.
 * Her muzzle is the tip of her sting in the art: 122 by 235 from her top-left, so a sting's box
 * starts 32 pixels ahead of it and is centered on it.
 */
export const QUEEN = {
  hitbox: { width: 300, height: 250 },
  postX: 940,
  enterSpeed: 3,
  rage: { part: 1, of: 3 },
  sting: { width: 32, height: 12, speed: 5, maxSlope: 3, muzzle: { x: 90, y: 229 } },
  volley: { count: 3, gapTicks: 12 },
  broodCount: 2,
  attacking: {
    moveSpeed: 1.5,
    pickHeightTicks: 120,
    attackTicks: 90,
    fan: [-2, 0, 2],
    broodTicks: 480,
  },
  enraged: {
    moveSpeed: 2.5,
    pickHeightTicks: 90,
    attackTicks: 60,
    fan: [-3, -1.5, 0, 1.5, 3],
    broodTicks: 300,
    chargeAfterTicks: 360,
  },
  charge: { windupTicks: 45, speed: 10 },
  defeat: { ticks: 90, explosionTicks: 15, sinkSpeed: 1 },
  sprite: {
    sheet: 'queen',
    rage: 'queen-rage',
    sting: 'sting',
    frameWidth: 600,
    frameHeight: 500,
  },
} as const satisfies BossConfig;
