import {
  createParticleSystem,
  createRng,
  defineParticleBurst,
  type ParticleBurst,
  type ParticleSystem,
  type Renderer,
} from '@buzzkill/engine';
import { type GameEventSource, RULES } from '@buzzkill/game';
import { tokens } from '@buzzkill/ui';

/**
 * The particles of a run (#156): sparks where a shot strikes, a flash at the muzzle, debris where
 * an insect breaks, dust where anything explodes, and a trail behind each shot. They are drawing
 * only: they follow the run's events and never touch the simulation, so replays stay the same.
 * Speeds are pixels per tick and lives are ticks, as in the game.
 */

/** How a particle looks; the engine hands it back with the particle. */
export interface ParticleLook {
  /** Behind the hero and the insects, or in front of them. */
  readonly layer: 'back' | 'front';
  /** A square, or a soft round puff drawn as two crossed rectangles. */
  readonly shape: 'square' | 'puff';
  /** The opacity at birth; it fades to nothing at the end of life. */
  readonly opacity: number;
}

const { palette } = tokens.primitives;

/** The colors from the design tokens, as the rest of the canvas takes them. */
const COLORS = {
  white: palette.neutral[0].value,
  pale: palette.neutral[50].value,
  amber: palette.amber[400].value,
  slate: palette.neutral[500].value,
  red: palette.red[400].value,
  dust: palette.neutral[300].value,
  lightDust: palette.neutral[200].value,
  darkDust: palette.neutral[700].value,
} as const;

/** The world scrolls left under everything that falls behind: explosions drift at this pace. */
const SCROLL = { x: -RULES.scrollSpeed, y: 0 } as const;

export const PARTICLE_BURSTS = {
  /** Sparks thrown back toward the shooter where a shot strikes an insect or the queen. */
  sparks: defineParticleBurst<ParticleLook>({
    count: 6,
    speed: { min: 1.5, max: 4.5 },
    direction: Math.PI,
    spread: Math.PI * 0.75,
    life: { min: 8, max: 16 },
    size: { min: 2, max: 4 },
    endSize: 0.2,
    gravity: 0.12,
    drag: 0.06,
    colors: [COLORS.white, COLORS.amber],
    style: { layer: 'front', shape: 'square', opacity: 1 },
  }),
  /** A short flash at the hero's muzzle, forward, with every shot. */
  muzzle: defineParticleBurst<ParticleLook>({
    count: 3,
    speed: { min: 1, max: 2.5 },
    direction: 0,
    spread: Math.PI * 0.6,
    life: { min: 5, max: 9 },
    size: { min: 2, max: 3 },
    endSize: 0.3,
    drag: 0.1,
    colors: [COLORS.white, COLORS.amber],
    style: { layer: 'front', shape: 'square', opacity: 0.9 },
  }),
  /** Bits of shell flung every way where an insect breaks, falling as the world scrolls on. */
  debris: defineParticleBurst<ParticleLook>({
    count: 10,
    speed: { min: 2, max: 5.5 },
    direction: -Math.PI / 2,
    spread: 2 * Math.PI,
    drift: SCROLL,
    life: { min: 30, max: 45 },
    size: { min: 4, max: 7 },
    endSize: 0.6,
    gravity: 0.15,
    drag: 0.03,
    // Mid tones, which read on the pale day sky and on the night sky alike.
    colors: [COLORS.slate, COLORS.amber, COLORS.red],
    style: { layer: 'front', shape: 'square', opacity: 1 },
  }),
  /** Soft puffs that swell and rise behind an explosion, drifting with it. */
  dust: defineParticleBurst<ParticleLook>({
    count: 7,
    speed: { min: 0.8, max: 1.8 },
    direction: 0,
    spread: 2 * Math.PI,
    drift: { x: SCROLL.x, y: -0.15 },
    life: { min: 40, max: 70 },
    size: { min: 12, max: 20 },
    endSize: 2,
    drag: 0.04,
    // Light puffs show at night, the dark one by day.
    colors: [COLORS.dust, COLORS.lightDust, COLORS.darkDust],
    style: { layer: 'back', shape: 'puff', opacity: 0.55 },
  }),
  /** Specks that a shot sheds as it flies, one every other tick, sinking as they fade. */
  trail: defineParticleBurst<ParticleLook>({
    count: 0.5,
    speed: { min: 0, max: 0.4 },
    direction: Math.PI / 2,
    spread: Math.PI,
    life: { min: 8, max: 14 },
    size: { min: 2, max: 3 },
    endSize: 0.3,
    gravity: 0.02,
    drag: 0.05,
    colors: [COLORS.amber, COLORS.pale],
    style: { layer: 'back', shape: 'square', opacity: 0.8 },
  }),
} as const;

/**
 * While motion is reduced, by the setting or the system (#114): bursts send out this share of their
 * particles, and each lives this share of its life.
 */
export const REDUCED_PARTICLES = { amount: 0.5, life: 0.6 } as const;

/**
 * The most game time one frame moves the particles, in ticks: after a stall, such as a tab in the
 * background, they go on from where they were instead of jumping.
 */
const MAX_FRAME_TICKS = 4;

/**
 * Particles each layer holds at most. A busy fight with rapid fire keeps about 250 behind (mostly
 * trails) and 70 in front; a full layer skips new particles rather than allocate.
 */
const CAPACITY = { back: 384, front: 256 } as const;

/** A puff's arms are this share of its size across: two of them make a soft round shape. */
const PUFF_WAIST = 0.6;

/** What the particles draw with: the engine renderer's rectangles. */
export type ParticleCanvas = Pick<Renderer<unknown>, 'fillRect'>;

export interface ParticleEffectsOptions {
  /** The particles setting, read at every burst and frame, so it applies to the run on screen. */
  readonly enabled: () => boolean;
  /** Whether motion is reduced, by the setting or the system; read at every burst. */
  readonly reducedMotion: () => boolean;
  /** Seeds the particles' own randomness, never the simulation's. */
  readonly seed: number;
}

export interface ParticleEffects {
  /** Follows the run's events, once: what bursts, and where. */
  listen(events: GameEventSource): void;
  /** Moves the particles on to `time`, the game's tick plus the frame's fraction of the next. */
  advance(time: number): void;
  /** Sheds the trail of a shot at (`x`, `y`) for `ticks` new ticks; none for none. */
  trail(x: number, y: number, ticks: number): void;
  /** Draws the particles behind the hero and the insects: dust and trails. */
  drawBack(canvas: ParticleCanvas): void;
  /** Draws the particles in front of them: sparks and debris. */
  drawFront(canvas: ParticleCanvas): void;
}

/** Creates the particles of one run, with both layers made up front. */
export function createParticleEffects(options: ParticleEffectsOptions): ParticleEffects {
  const rng = createRng(options.seed >>> 0);
  const back = createParticleSystem<ParticleLook>({ capacity: CAPACITY.back, rng });
  const front = createParticleSystem<ParticleLook>({ capacity: CAPACITY.front, rng });
  let lastTime: number | undefined;

  const burst = (kind: ParticleBurst<ParticleLook>, x: number, y: number, amount = 1): void => {
    if (!options.enabled()) {
      return;
    }
    const reduced = options.reducedMotion();
    const layer = kind.style.layer === 'back' ? back : front;
    layer.emit(
      kind,
      x,
      y,
      reduced ? amount * REDUCED_PARTICLES.amount : amount,
      reduced ? REDUCED_PARTICLES.life : 1,
    );
  };

  return {
    listen(events) {
      events.on('shot', ({ x, y }) => {
        burst(PARTICLE_BURSTS.muzzle, x, y);
      });
      events.on('enemyHit', ({ x, y }) => {
        burst(PARTICLE_BURSTS.sparks, x, y);
      });
      events.on('bossHit', ({ x, y }) => {
        burst(PARTICLE_BURSTS.sparks, x, y);
      });
      events.on('enemyDestroyed', ({ x, y }) => {
        burst(PARTICLE_BURSTS.debris, x, y);
      });
      events.on('bossDefeated', ({ x, y }) => {
        burst(PARTICLE_BURSTS.debris, x, y, 3);
      });
      events.on('explosion', ({ x, y }) => {
        burst(PARTICLE_BURSTS.dust, x, y);
      });
    },
    advance(time) {
      const dt =
        lastTime === undefined ? 0 : Math.min(Math.max(time - lastTime, 0), MAX_FRAME_TICKS);
      lastTime = time;
      if (!options.enabled()) {
        back.clear();
        front.clear();
        return;
      }
      back.update(dt);
      front.update(dt);
    },
    trail(x, y, ticks) {
      if (ticks > 0) {
        burst(PARTICLE_BURSTS.trail, x, y, ticks);
      }
    },
    drawBack(canvas) {
      draw(back, canvas);
    },
    drawFront(canvas) {
      draw(front, canvas);
    },
  };
}

/** Draws each particle at its middle, shrunk or swollen and faded by its age. */
function draw(particles: ParticleSystem<ParticleLook>, canvas: ParticleCanvas): void {
  for (let index = 0; index < particles.count; index += 1) {
    const particle = particles.at(index);
    const { x, y, color, style } = particle;
    const aged = particle.age / particle.life;
    const size = particle.size * (1 + (particle.endSize - 1) * aged);
    const alpha = style.opacity * (1 - aged);
    const half = size * 0.5;
    if (style.shape === 'square') {
      canvas.fillRect(x - half, y - half, size, size, color, alpha);
      continue;
    }
    const waist = size * PUFF_WAIST;
    canvas.fillRect(x - half, y - waist * 0.5, size, waist, color, alpha);
    canvas.fillRect(x - waist * 0.5, y - half, waist, size, color, alpha);
  }
}
