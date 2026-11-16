import type { Rng } from '../math/rng';
import { createPool } from '../pool/object-pool';

/**
 * Particles: sparks, debris, dust and trails that only decorate (#156). They live on an object pool
 * created up front, so emitting and updating allocate nothing in the frame loop (CLAUDE.md, "Hot
 * loop"), and a full pool skips particles instead of growing.
 *
 * Particles are drawing only. Their randomness comes from an RNG of their own, never from the
 * simulation's, so they cannot change the course of a run. The engine is unit-agnostic: speeds are
 * pixels per unit of time and lives are units of time, and `update` takes the time passed in the
 * same unit. The game uses ticks.
 */

/** A closed range of numbers, `min` to `max` both included. */
export interface ParticleRange {
  readonly min: number;
  readonly max: number;
}

/** What one call of `emit` sends out. `defineParticleBurst` checks it once. */
export interface ParticleBurst<TStyle> {
  /** Particles a call, before `emit` scales them; a fraction comes out whole by chance. */
  readonly count: number;
  /** Launch speed in pixels per unit of time. */
  readonly speed: ParticleRange;
  /** The middle of the launch directions in radians: 0 points right, π/2 down (y grows down). */
  readonly direction: number;
  /** How wide the cone of directions is around `direction`: 0 is one line, 2π every way. */
  readonly spread: number;
  /** Velocity every particle also gets, such as the world's scroll. None by default. */
  readonly drift?: { readonly x: number; readonly y: number };
  /** Life in units of time, more than 0. */
  readonly life: ParticleRange;
  /** Size at birth in pixels. */
  readonly size: ParticleRange;
  /**
   * Size at the end of life as a share of the size at birth: 1 by default, and 0 shrinks to
   * nothing.
   */
  readonly endSize?: number;
  /** Added to the downward speed each unit of time. 0 by default. */
  readonly gravity?: number;
  /** Share of the speed lost each unit of time, at least 0 and below 1. 0 by default. */
  readonly drag?: number;
  /** One is picked at random for each particle. */
  readonly colors: readonly [string, ...string[]];
  /** Handed to the drawing code with every particle; the engine never reads it. */
  readonly style: TStyle;
}

/** A live particle. Drawing code reads it; only the system writes it. */
export interface Particle<TStyle> {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Time lived, always below `life`. */
  age: number;
  life: number;
  /** Size at birth; `endSize` is the share of it left at the end of life. */
  size: number;
  endSize: number;
  gravity: number;
  drag: number;
  color: string;
  style: TStyle;
}

export interface ParticleSystem<TStyle> {
  readonly capacity: number;
  /** Live particles: the indices `[0, count)` of `at`. */
  readonly count: number;
  /**
   * The live particle at `index`, in no fixed order.
   *
   * @throws RangeError when `index` is outside `[0, count)`.
   */
  at(index: number): Readonly<Particle<TStyle>>;
  /**
   * Sends out `burst.count × amount` particles from (`x`, `y`), each living `lifeScale` times its
   * life. Returns how many came out: fewer when the pool is full, and never an error then.
   *
   * @throws RangeError when `amount` is negative or not finite, or `lifeScale` is not above 0.
   */
  emit(
    burst: ParticleBurst<TStyle>,
    x: number,
    y: number,
    amount?: number,
    lifeScale?: number,
  ): number;
  /** Ages, pulls down, slows and moves every particle by `dt`; frees those whose life is over. */
  update(dt: number): void;
  /** Frees every particle. */
  clear(): void;
}

export interface ParticleSystemOptions {
  /** The most particles alive at once: all are made at the start. */
  readonly capacity: number;
  /** The particles' own randomness; never the simulation's RNG. */
  readonly rng: Rng;
}

const TWO_PI = 2 * Math.PI;

const isRange = (range: ParticleRange, lowest: number): boolean =>
  Number.isFinite(range.min) &&
  Number.isFinite(range.max) &&
  range.min >= lowest &&
  range.min <= range.max;

/**
 * Checks a burst once, where it is defined, so `emit` need not check it on every call. Returns it
 * unchanged.
 *
 * @throws RangeError for a negative count, speed or size, a life of no time, a range whose `min` is
 *   above its `max`, a spread outside [0, 2π], a drag outside [0, 1), a negative end size, a
 *   direction that is not a number, or no colors.
 */
export function defineParticleBurst<TStyle>(burst: ParticleBurst<TStyle>): ParticleBurst<TStyle> {
  const { endSize = 1, gravity = 0, drag = 0, drift } = burst;
  const problems = [
    !(Number.isFinite(burst.count) && burst.count >= 0) && 'count must be at least 0',
    !isRange(burst.speed, 0) && 'speed must be a range from 0 up',
    !Number.isFinite(burst.direction) && 'direction must be a number',
    !(burst.spread >= 0 && burst.spread <= TWO_PI) && 'spread must be in [0, 2π]',
    !(isRange(burst.life, 0) && burst.life.min > 0) && 'life must be a range above 0',
    !isRange(burst.size, 0) && 'size must be a range from 0 up',
    !(Number.isFinite(endSize) && endSize >= 0) && 'endSize must be at least 0',
    !Number.isFinite(gravity) && 'gravity must be a number',
    !(drag >= 0 && drag < 1) && 'drag must be in [0, 1)',
    drift !== undefined &&
      !(Number.isFinite(drift.x) && Number.isFinite(drift.y)) &&
      'drift must be numbers',
    burst.colors.length === 0 && 'colors must name at least one color',
  ].filter((problem) => problem !== false);
  if (problems.length > 0) {
    throw new RangeError(`defineParticleBurst: ${problems.join('; ')}`);
  }
  return burst;
}

/** Creates a system of `capacity` particles, all made now and reused for as long as it lives. */
export function createParticleSystem<TStyle>(
  options: ParticleSystemOptions,
): ParticleSystem<TStyle> {
  const { rng } = options;
  const pool = createPool<Particle<TStyle>>({
    capacity: options.capacity,
    create: () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      age: 0,
      life: 1,
      size: 0,
      endSize: 1,
      gravity: 0,
      drag: 0,
      color: '',
      // Only `emit` hands a particle out, and it sets the style first, so this placeholder is never
      // read; the type has no value of its own to start with.
      style: undefined as TStyle,
    }),
  });

  /** A number in [min, max]. */
  const pick = (range: ParticleRange): number =>
    range.min === range.max ? range.min : range.min + rng.nextFloat() * (range.max - range.min);

  return {
    capacity: pool.capacity,
    get count() {
      return pool.active;
    },
    at(index) {
      return pool.at(index);
    },
    emit(burst, x, y, amount = 1, lifeScale = 1) {
      if (!(Number.isFinite(amount) && amount >= 0)) {
        throw new RangeError(`emit: amount must be a finite number >= 0, got ${String(amount)}`);
      }
      if (!(Number.isFinite(lifeScale) && lifeScale > 0)) {
        throw new RangeError(
          `emit: lifeScale must be a finite number > 0, got ${String(lifeScale)}`,
        );
      }
      const wanted = burst.count * amount;
      let whole = Math.floor(wanted);
      if (wanted > whole && rng.nextFloat() < wanted - whole) {
        whole += 1;
      }
      const { colors, drift, spread } = burst;
      const driftX = drift?.x ?? 0;
      const driftY = drift?.y ?? 0;
      let emitted = 0;
      for (; emitted < whole; emitted += 1) {
        const particle = pool.acquire();
        if (particle === undefined) {
          break;
        }
        const angle =
          spread === 0 ? burst.direction : burst.direction + (rng.nextFloat() - 0.5) * spread;
        const speed = pick(burst.speed);
        particle.x = x;
        particle.y = y;
        particle.vx = Math.cos(angle) * speed + driftX;
        particle.vy = Math.sin(angle) * speed + driftY;
        particle.age = 0;
        particle.life = pick(burst.life) * lifeScale;
        particle.size = pick(burst.size);
        particle.endSize = burst.endSize ?? 1;
        particle.gravity = burst.gravity ?? 0;
        particle.drag = burst.drag ?? 0;
        // A burst has at least one color, so the index is always in bounds.
        particle.color =
          colors.length === 1 ? colors[0] : (colors[rng.nextInt(0, colors.length - 1)] as string);
        particle.style = burst.style;
      }
      return emitted;
    },
    update(dt) {
      if (!(dt > 0)) {
        return;
      }
      // Backwards, because a release moves the last live particle into the freed place, and the
      // last one has been updated already.
      for (let index = pool.active - 1; index >= 0; index -= 1) {
        const particle = pool.at(index);
        particle.age += dt;
        if (particle.age >= particle.life) {
          pool.release(particle);
          continue;
        }
        particle.vy += particle.gravity * dt;
        // Linear in `dt` rather than a power, which is good enough for a decoration; a long frame
        // stops the particle instead of turning it back.
        const keep = 1 - particle.drag * dt;
        if (keep <= 0) {
          particle.vx = 0;
          particle.vy = 0;
        } else if (keep < 1) {
          particle.vx *= keep;
          particle.vy *= keep;
        }
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
      }
    },
    clear() {
      pool.releaseAll();
    },
  };
}
