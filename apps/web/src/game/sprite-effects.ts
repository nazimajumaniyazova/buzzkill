import { type EntityId, type GameEventSource, type GameView, Kind } from '@buzzkill/game';
import { tokens } from '@buzzkill/ui';

/**
 * What a hit and a shot do to the sprites (#159): a sprite that is hit flashes white for a moment,
 * the hero squashes a little when firing, and insects stretch as they bob. Drawing only: these
 * follow the run's events and the world, and never touch the simulation. Times are ticks.
 */

/** The flash of a hit, from the same sprite tinted by the renderer. */
export const FLASH = {
  color: tokens.primitives.palette.neutral[0].value,
  /** How long a flash lasts: it fades from its amount to nothing. */
  ticks: 8,
  /** How much white a flash starts with. */
  amount: 0.8,
  /** The same, softer, while motion is reduced. */
  reducedAmount: 0.4,
  /**
   * Flashes start at most every 20 ticks, three times a second, across the whole screen (WCAG
   * 2.3.1). Hits of the same moment flash together; a hit too soon after a flash does not flash.
   */
  gapTicks: 20,
} as const;

/** The hero squashes when firing: wider and lower, back to its shape over a few ticks. */
export const SQUASH = { ticks: 6, amount: 0.08 } as const;

/** Insects stretch upright by how far they moved up or down in a tick, up to `max`. */
export const STRETCH = { perPixel: 0.06, max: 0.12 } as const;

/** How much wider (`x`) and taller (`y`) a sprite is drawn, about the middle of its base. */
export interface SpriteScale {
  readonly x: number;
  readonly y: number;
}

/** Drawn at its own size. */
export const NO_SCALE: SpriteScale = Object.freeze({ x: 1, y: 1 });

export interface SpriteEffectsOptions {
  /** The hit flash setting, read every frame. */
  readonly hitFlash: () => boolean;
  /** The squash and stretch setting, read every frame. */
  readonly squashStretch: () => boolean;
  /** Whether motion is reduced: softer flashes, and no squash or stretch. */
  readonly reducedMotion: () => boolean;
}

export interface SpriteEffects {
  /** Follows the run's events, once: the hits that flash and the shots that squash. */
  listen(events: GameEventSource): void;
  /** Starts a frame: the hits and shots since the last frame take effect from this tick. */
  begin(view: GameView): void;
  /** How much white entity `id` takes at `time`, from 0, none, to 1. */
  flash(view: GameView, id: EntityId, time: number): number;
  /** The hero's squash at `time`. The same object as `enemyScale` gives: read it at once. */
  heroScale(time: number): SpriteScale;
  /** The stretch of an insect that moved `dy` pixels in its last tick. Read it at once, too. */
  enemyScale(dy: number): SpriteScale;
}

interface InsectFlash {
  readonly start: number;
  /** The insect's birth tick, so that a new insect under a reused id does not flash. */
  readonly born: number;
}

/** Creates the sprite effects of one run. */
export function createSpriteEffects(options: SpriteEffectsOptions): SpriteEffects {
  const pendingInsects: EntityId[] = [];
  let pendingHero = false;
  let pendingQueen = false;
  let pendingShot = false;
  const insects = new Map<EntityId, InsectFlash>();
  let heroStart = Number.NEGATIVE_INFINITY;
  let queenStart = Number.NEGATIVE_INFINITY;
  let lastStart = Number.NEGATIVE_INFINITY;
  let squashStart = Number.NEGATIVE_INFINITY;
  // Rewritten by `heroScale` and `enemyScale`, so a frame allocates nothing.
  const scale = { x: 1, y: 1 };

  const squashes = (): boolean => options.squashStretch() && !options.reducedMotion();

  const fade = (start: number, time: number): number => {
    const age = time - start;
    if (!(age >= 0 && age < FLASH.ticks)) {
      return 0;
    }
    const amount = options.reducedMotion() ? FLASH.reducedAmount : FLASH.amount;
    return amount * (1 - age / FLASH.ticks);
  };

  const stopFlashes = (): void => {
    insects.clear();
    heroStart = Number.NEGATIVE_INFINITY;
    queenStart = Number.NEGATIVE_INFINITY;
  };

  return {
    listen(events) {
      events.on('enemyHit', ({ id }) => {
        pendingInsects.push(id);
      });
      events.on('playerHit', () => {
        pendingHero = true;
      });
      events.on('bossHit', () => {
        pendingQueen = true;
      });
      events.on('shot', () => {
        pendingShot = true;
      });
    },
    begin(view) {
      const { tick, world } = view;
      const hits = pendingInsects.length > 0 || pendingHero || pendingQueen;
      if (!options.hitFlash()) {
        stopFlashes();
      } else if (hits && (tick === lastStart || tick - lastStart >= FLASH.gapTicks)) {
        lastStart = tick;
        // Only when a flash starts, at most three times a second: the finished ones go.
        for (const [id, { start }] of insects) {
          if (tick - start >= FLASH.ticks) {
            insects.delete(id);
          }
        }
        for (const id of pendingInsects) {
          if (world.isAlive(id)) {
            insects.set(id, { start: tick, born: world.bornTick[id] as number });
          }
        }
        heroStart = pendingHero ? tick : heroStart;
        queenStart = pendingQueen ? tick : queenStart;
      }
      pendingInsects.length = 0;
      pendingHero = false;
      pendingQueen = false;

      if (!squashes()) {
        squashStart = Number.NEGATIVE_INFINITY;
      } else if (pendingShot) {
        squashStart = tick;
      }
      pendingShot = false;
    },
    flash(view, id, time) {
      if (!options.hitFlash()) {
        return 0;
      }
      const { world } = view;
      // A typed-array read in bounds: `id` is a live entity of this world.
      switch (world.kind[id] as number) {
        case Kind.player:
          return fade(heroStart, time);
        case Kind.boss:
          return fade(queenStart, time);
        case Kind.enemy: {
          const insect = insects.get(id);
          return insect !== undefined && world.bornTick[id] === insect.born
            ? fade(insect.start, time)
            : 0;
        }
        default:
          return 0;
      }
    },
    heroScale(time) {
      const age = time - squashStart;
      if (!squashes() || !(age >= 0 && age < SQUASH.ticks)) {
        return NO_SCALE;
      }
      const squash = SQUASH.amount * (1 - age / SQUASH.ticks);
      scale.x = 1 + squash;
      scale.y = 1 - squash;
      return scale;
    },
    enemyScale(dy) {
      const stretch = Math.min(Math.abs(dy) * STRETCH.perPixel, STRETCH.max);
      if (!squashes() || stretch === 0) {
        return NO_SCALE;
      }
      scale.y = 1 + stretch;
      scale.x = 1 / scale.y;
      return scale;
    },
  };
}
