/**
 * The power-ups a destroyed enemy may drop (#151). Units follow the simulation: lengths in world
 * pixels, speeds in pixels per tick, durations in ticks at 60 Hz. The owner approved the kinds,
 * their effects and the drop chances on 2026-11-13.
 */

interface PowerUpBase {
  /** How often this kind drops, relative to the weights of the others. */
  readonly weight: number;
  /** Its sprite in `@buzzkill/art`. */
  readonly sprite: { readonly sheet: string };
}

/** Rounds of ammo, up to the most the difficulty allows. */
interface AmmoPowerUp extends PowerUpBase {
  readonly kind: 'ammo';
  readonly rounds: number;
}

/** Lives, up to the number the run started with. */
interface LifePowerUp extends PowerUpBase {
  readonly kind: 'life';
  readonly lives: number;
}

/** While it lasts, an enemy that flies into the hero explodes and takes no life. */
interface ShieldPowerUp extends PowerUpBase {
  readonly kind: 'shield';
  readonly durationTicks: number;
}

/** While it lasts, holding fire shoots every `intervalTicks`, and no shot costs a round. */
interface RapidFirePowerUp extends PowerUpBase {
  readonly kind: 'rapidFire';
  readonly durationTicks: number;
  readonly intervalTicks: number;
}

export type PowerUpConfig = AmmoPowerUp | LifePowerUp | ShieldPowerUp | RapidFirePowerUp;
export type PowerUpKind = PowerUpConfig['kind'];

const AMMO = {
  kind: 'ammo',
  weight: 4,
  rounds: 15,
  sprite: { sheet: 'power-ammo' },
} as const satisfies AmmoPowerUp;

const LIFE = {
  kind: 'life',
  weight: 1,
  lives: 1,
  sprite: { sheet: 'power-life' },
} as const satisfies LifePowerUp;

/** 10 s. Collecting another while it lasts starts the time over; the times do not add up. */
export const SHIELD = {
  kind: 'shield',
  weight: 2,
  durationTicks: 600,
  sprite: { sheet: 'power-shield' },
} as const satisfies ShieldPowerUp;

/** 8 s at 10 shots a second. Like the shield, another one starts the time over. */
export const RAPID_FIRE = {
  kind: 'rapidFire',
  weight: 2,
  durationTicks: 480,
  intervalTicks: 6,
  sprite: { sheet: 'power-rapid-fire' },
} as const satisfies RapidFirePowerUp;

/**
 * Every kind in the order of the roll: a power-up's `variant` in the world is its index here, so
 * reordering the list changes every replay (ADR-0009).
 */
export const POWER_UPS = [AMMO, LIFE, SHIELD, RAPID_FIRE] as const;

export const POWER_UP_RULES = {
  /** The chance that an enemy destroyed by a shot drops a power-up. */
  dropChance: 0.12,
  /** Collision box and drawing size: the art's 64 px frame at half size, its halo included. */
  size: 32,
  /**
   * Pixels per tick to the left: the slowest enemy's base speed, so a power-up stays on screen
   * long enough for the hero, who only moves up and down, to line up with it.
   */
  speed: 1.5,
} as const;
