// @vitest-environment node
import { createEventBus } from '@buzzkill/engine';
import type { EntityId, GameEvents } from '@buzzkill/game';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  createParticleEffects,
  PARTICLE_BURSTS,
  type ParticleCanvas,
  type ParticleEffects,
  REDUCED_PARTICLES,
} from './particles';

/** An insect of no world: the particles take the point of a hit and never read the insect. */
const INSECT = 3 as EntityId;

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly color: string;
  readonly alpha: number;
}

function createCanvas() {
  const rects: Rect[] = [];
  const canvas: ParticleCanvas = {
    fillRect(x, y, width, height, color, alpha = 1) {
      rects.push({ x, y, width, height, color, alpha });
    },
  };
  return {
    canvas,
    /** Takes the rectangles drawn since the last call. */
    take(): Rect[] {
      return rects.splice(0);
    },
  };
}

/** The middle of a rectangle, rounded so that floating-point noise does not matter. */
const middle = ({ x, y, width, height }: Rect) => ({
  x: Math.round((x + width / 2) * 1000) / 1000,
  y: Math.round((y + height / 2) * 1000) / 1000,
});

describe('createParticleEffects', () => {
  let enabled: boolean;
  let reduced: boolean;
  let events: ReturnType<typeof createEventBus<GameEvents>>;
  let effects: ParticleEffects;
  let canvas: ReturnType<typeof createCanvas>;

  beforeEach(() => {
    enabled = true;
    reduced = false;
    events = createEventBus<GameEvents>();
    effects = createParticleEffects({
      enabled: () => enabled,
      reducedMotion: () => reduced,
      seed: 1,
    });
    effects.listen(events);
    canvas = createCanvas();
  });

  const drawBack = (): Rect[] => {
    effects.drawBack(canvas.canvas);
    return canvas.take();
  };
  const drawFront = (): Rect[] => {
    effects.drawFront(canvas.canvas);
    return canvas.take();
  };

  it('throws sparks in front of the insects where a shot strikes an insect or the queen', () => {
    events.emit('enemyHit', { id: INSECT, healthLeft: 1, x: 100, y: 50 });
    events.emit('bossHit', { healthLeft: 40, x: 900, y: 300 });
    effects.advance(0);

    const front = drawFront();
    const { count, colors } = PARTICLE_BURSTS.sparks;
    expect(front).toHaveLength(2 * count);
    expect(front.slice(0, count).map(middle)).toEqual(Array(count).fill({ x: 100, y: 50 }));
    expect(front.slice(count).map(middle)).toEqual(Array(count).fill({ x: 900, y: 300 }));
    expect(front.every(({ color }) => colors.includes(color))).toBe(true);
    expect(drawBack()).toEqual([]);
  });

  it('flashes a few sparks at the muzzle of every shot', () => {
    events.emit('shot', { x: 180, y: 120 });
    effects.advance(0);

    expect(drawFront().map(middle)).toEqual(
      Array(PARTICLE_BURSTS.muzzle.count).fill({ x: 180, y: 120 }),
    );
  });

  it('leaves debris in front and puffs of dust behind where an insect breaks', () => {
    events.emit('enemyDestroyed', { x: 300, y: 200, value: 2 });
    events.emit('explosion', { x: 300, y: 200, variant: 0 });
    effects.advance(0);

    expect(drawFront()).toHaveLength(PARTICLE_BURSTS.debris.count);
    // A puff is two crossed rectangles around its middle.
    const back = drawBack();
    expect(back).toHaveLength(2 * PARTICLE_BURSTS.dust.count);
    expect(back.map(middle)).toEqual(Array(back.length).fill({ x: 300, y: 200 }));
    expect(back[0]?.width).toBeGreaterThan(back[0]?.height ?? Number.POSITIVE_INFINITY);
    expect(back[1]?.height).toBeGreaterThan(back[1]?.width ?? Number.POSITIVE_INFINITY);
  });

  it('breaks the queen into three times the debris of an insect', () => {
    events.emit('bossDefeated', { x: 1000, y: 360, value: 60 });
    effects.advance(0);

    expect(drawFront()).toHaveLength(3 * PARTICLE_BURSTS.debris.count);
  });

  it('lays a trail behind a shot, for each new tick only', () => {
    effects.trail(400, 100, 0);
    effects.advance(0);
    expect(drawBack()).toEqual([]);

    effects.trail(400, 100, 4);
    effects.advance(0);
    expect(drawBack()).toHaveLength(4 * PARTICLE_BURSTS.trail.count);
    expect(drawFront()).toEqual([]);
  });

  it('fades and shrinks a particle as it ages, and lets it go at the end of its life', () => {
    events.emit('enemyHit', { id: INSECT, healthLeft: 1, x: 100, y: 50 });
    effects.advance(0);
    const born = drawFront();
    effects.advance(4);
    const older = drawFront();

    expect(born.every(({ alpha }) => alpha === PARTICLE_BURSTS.sparks.style.opacity)).toBe(true);
    for (const [index, rect] of older.entries()) {
      expect(rect.alpha).toBeLessThan(born[index]?.alpha ?? 0);
      expect(rect.width).toBeLessThan(born[index]?.width ?? 0);
    }
    // Four ticks at a time, the most a frame moves them, past the longest life.
    for (let time = 8; time <= 4 + PARTICLE_BURSTS.sparks.life.max; time += 4) {
      effects.advance(time);
    }
    expect(drawFront()).toEqual([]);
  });

  it('moves the particles at most four ticks in a frame, and not at all when time goes back', () => {
    events.emit('enemyDestroyed', { x: 300, y: 200, value: 2 });
    effects.advance(10);
    effects.advance(1000);
    const after = drawFront();
    effects.advance(500);

    // Debris lives over 30 ticks: after one long frame it is still there, four ticks older.
    expect(after).toHaveLength(PARTICLE_BURSTS.debris.count);
    expect(drawFront()).toEqual(after);
  });

  it('bursts nothing while particles are off, and clears those left when they are turned off', () => {
    events.emit('enemyDestroyed', { x: 300, y: 200, value: 2 });
    effects.advance(0);
    enabled = false;
    effects.advance(1);
    events.emit('enemyHit', { id: INSECT, healthLeft: 1, x: 100, y: 50 });
    effects.trail(400, 100, 1);
    effects.advance(2);

    expect(drawFront()).toEqual([]);
    expect(drawBack()).toEqual([]);
  });

  it('bursts fewer and shorter particles while motion is reduced', () => {
    const shortest = PARTICLE_BURSTS.debris.life.min;
    const longest = PARTICLE_BURSTS.debris.life.max;
    for (const motion of [false, true]) {
      reduced = motion;
      events.emit('enemyDestroyed', { x: 300, y: 200, value: 2 });
    }
    effects.advance(0);
    expect(drawFront()).toHaveLength(PARTICLE_BURSTS.debris.count * (1 + REDUCED_PARTICLES.amount));

    // Past the longest reduced life and before the shortest full one, only the full burst is left.
    const between = longest * REDUCED_PARTICLES.life + 1;
    expect(between).toBeLessThan(shortest);
    for (let time = 0; time < between; time += 1) {
      effects.advance(time + 1);
    }
    expect(drawFront()).toHaveLength(PARTICLE_BURSTS.debris.count);
  });
});
