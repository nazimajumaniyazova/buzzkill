import { type Camera, createRng, createScreenShake, IDENTITY_CAMERA } from '@buzzkill/engine';
import { type GameEventSource, WORLD } from '@buzzkill/game';

/**
 * The screen shake of a run (#157): the game's strong moments add trauma, which drains away, and
 * the camera trembles by its square. Drawing only: the shake follows the run's events and never
 * touches the simulation, so replays stay the same. Times are ticks, as in the game.
 */

/**
 * The trauma each event adds, from 0 to 1: a hit on the hero far more than an explosion, which
 * comes with every kill, and the queen's fall the most. Trauma adds up to 1.
 */
export const TRAUMA = {
  playerHit: 0.6,
  explosion: 0.3,
  bossHit: 0.05,
  bossEntered: 0.35,
  bossEnraged: 0.5,
  bossDefeated: 1,
} as const;

/** How far and how fast the camera trembles. */
export const SHAKE = {
  /** The offset at full trauma, in pixels of the world, either way. */
  maxOffset: 14,
  /** The rotation at full trauma, in radians, either way: about 1.4°. */
  maxAngle: 0.025,
  /** Trauma lost a tick: a full trauma drains in one second. */
  decay: 1 / WORLD.ticksPerSecond,
  /** Noise knots a tick: about 20 turns of direction a second. */
  frequency: 0.35,
} as const;

/** The most game time one frame drains, in ticks: after a stall the shake goes on from there. */
const MAX_FRAME_TICKS = 4;

export interface ShakeEffectsOptions {
  /** The screen shake setting, read at every event and frame. */
  readonly enabled: () => boolean;
  /** Whether motion is reduced, by the setting or the system: then nothing shakes at all. */
  readonly reducedMotion: () => boolean;
  /** Seeds the noise; never the simulation's RNG. */
  readonly seed: number;
}

export interface ShakeEffects {
  /** Follows the run's events, once: what adds trauma, and how much. */
  listen(events: GameEventSource): void;
  /**
   * Drains the trauma up to `time`, the game's tick plus the frame's fraction of the next, and
   * returns the camera of the frame: `IDENTITY_CAMERA` while still, off or under reduced motion.
   */
  advance(time: number): Camera;
}

/** Creates the screen shake of one run. */
export function createShakeEffects(options: ShakeEffectsOptions): ShakeEffects {
  const shake = createScreenShake({
    // A stream of its own, apart from the particles', which take the seed as it is.
    rng: createRng((options.seed ^ 0x9e_37_79_b9) >>> 0),
    ...SHAKE,
    width: WORLD.width,
    height: WORLD.height,
  });
  const allowed = (): boolean => options.enabled() && !options.reducedMotion();
  let lastTime: number | undefined;

  const knock = (amount: number): void => {
    if (allowed()) {
      shake.add(amount);
    }
  };

  return {
    listen(events) {
      events.on('playerHit', () => {
        knock(TRAUMA.playerHit);
      });
      events.on('explosion', () => {
        knock(TRAUMA.explosion);
      });
      events.on('bossHit', () => {
        knock(TRAUMA.bossHit);
      });
      events.on('bossEntered', () => {
        knock(TRAUMA.bossEntered);
      });
      events.on('bossEnraged', () => {
        knock(TRAUMA.bossEnraged);
      });
      events.on('bossDefeated', () => {
        knock(TRAUMA.bossDefeated);
      });
    },
    advance(time) {
      const dt =
        lastTime === undefined ? 0 : Math.min(Math.max(time - lastTime, 0), MAX_FRAME_TICKS);
      lastTime = time;
      if (!allowed()) {
        shake.clear();
        return IDENTITY_CAMERA;
      }
      shake.update(dt);
      return shake.trauma === 0 ? IDENTITY_CAMERA : shake.camera(time);
    },
  };
}
