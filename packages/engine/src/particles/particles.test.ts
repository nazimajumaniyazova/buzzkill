// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import { createRng } from '../math/rng';
import {
  createParticleSystem,
  defineParticleBurst,
  type Particle,
  type ParticleBurst,
  type ParticleSystem,
} from './particles';

type Style = 'spark' | 'dust';

/** One particle a call, straight to the right at 2 px a tick, for 10 ticks: nothing random. */
const STRAIGHT: ParticleBurst<Style> = defineParticleBurst({
  count: 1,
  speed: { min: 2, max: 2 },
  direction: 0,
  spread: 0,
  life: { min: 10, max: 10 },
  size: { min: 4, max: 4 },
  colors: ['#fff'],
  style: 'spark',
});

const system = (capacity = 16): ParticleSystem<Style> =>
  createParticleSystem<Style>({ capacity, rng: createRng(1) });

const all = (particles: ParticleSystem<Style>): Readonly<Particle<Style>>[] =>
  Array.from({ length: particles.count }, (_, index) => particles.at(index));

describe('createParticleSystem', () => {
  it('emits the burst at the point, with its speed in its direction', () => {
    const particles = system();

    expect(particles.emit({ ...STRAIGHT, count: 3 }, 5, 7)).toBe(3);

    expect(particles.count).toBe(3);
    expect(all(particles)).toEqual(
      Array.from({ length: 3 }, () => ({
        x: 5,
        y: 7,
        vx: 2,
        vy: 0,
        age: 0,
        life: 10,
        size: 4,
        endSize: 1,
        gravity: 0,
        drag: 0,
        color: '#fff',
        style: 'spark',
      })),
    );
  });

  it('turns the launch by the direction, downward for a quarter turn', () => {
    const particles = system();

    particles.emit({ ...STRAIGHT, direction: Math.PI / 2 }, 0, 0);

    const [particle] = all(particles);
    expect(particle?.vx).toBeCloseTo(0, 12);
    expect(particle?.vy).toBeCloseTo(2, 12);
  });

  it('adds the drift to every launch, and keeps the size, gravity and drag of the burst', () => {
    const particles = system();

    particles.emit(
      { ...STRAIGHT, drift: { x: -1, y: -0.5 }, endSize: 0.5, gravity: 0.2, drag: 0.1 },
      0,
      0,
    );

    expect(all(particles)[0]).toMatchObject({
      vx: 1,
      vy: -0.5,
      endSize: 0.5,
      gravity: 0.2,
      drag: 0.1,
    });
  });

  it('picks each direction, speed, life, size and color within the burst', () => {
    const particles = system(400);
    const burst = defineParticleBurst<Style>({
      count: 400,
      speed: { min: 1, max: 3 },
      direction: Math.PI,
      spread: Math.PI / 2,
      life: { min: 20, max: 30 },
      size: { min: 2, max: 5 },
      colors: ['#f00', '#0f0', '#00f'],
      style: 'dust',
    });

    particles.emit(burst, 0, 0);

    const emitted = all(particles);
    expect(emitted).toHaveLength(400);
    for (const { vx, vy, life, size, style } of emitted) {
      const speed = Math.hypot(vx, vy);
      const angle = Math.atan2(vy, vx);
      // Left, a quarter turn wide: within an eighth of a turn of π either way.
      expect(Math.abs(Math.abs(angle) - Math.PI)).toBeLessThanOrEqual(Math.PI / 4 + 1e-9);
      expect(speed).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(speed).toBeLessThanOrEqual(3 + 1e-9);
      expect(life).toBeGreaterThanOrEqual(20);
      expect(life).toBeLessThanOrEqual(30);
      expect(size).toBeGreaterThanOrEqual(2);
      expect(size).toBeLessThanOrEqual(5);
      expect(style).toBe('dust');
    }
    expect(new Set(emitted.map(({ color }) => color))).toEqual(new Set(['#f00', '#0f0', '#00f']));
  });

  it('scales the count by the amount, a fraction of a particle by chance', () => {
    const particles = system(2000);

    expect(particles.emit({ ...STRAIGHT, count: 4 }, 0, 0, 2)).toBe(8);
    expect(particles.emit({ ...STRAIGHT, count: 4 }, 0, 0, 0)).toBe(0);
    particles.clear();
    for (let i = 0; i < 1000; i += 1) {
      particles.emit(STRAIGHT, 0, 0, 0.5);
    }

    // About half of a thousand half particles come out whole.
    expect(particles.count).toBeGreaterThan(400);
    expect(particles.count).toBeLessThan(600);
  });

  it('scales the life by its own factor', () => {
    const particles = system();

    particles.emit(STRAIGHT, 0, 0, 1, 0.5);

    expect(all(particles)[0]?.life).toBe(5);
  });

  it('stops at its capacity and says how many it emitted', () => {
    const particles = system(4);

    expect(particles.emit({ ...STRAIGHT, count: 3 }, 0, 0)).toBe(3);
    expect(particles.emit({ ...STRAIGHT, count: 3 }, 0, 0)).toBe(1);
    expect(particles.emit(STRAIGHT, 0, 0)).toBe(0);

    expect(particles.count).toBe(4);
  });

  it('moves, pulls down and slows each particle by the time passed', () => {
    const particles = system();
    particles.emit({ ...STRAIGHT, gravity: 0.5 }, 5, 7);
    particles.emit({ ...STRAIGHT, drag: 0.25 }, 5, 7);

    particles.update(2);

    expect(all(particles)).toEqual([
      // Gravity first: 0.5 a tick for 2 ticks, then the move.
      expect.objectContaining({ x: 9, y: 9, vx: 2, vy: 1, age: 2 }),
      // A quarter of the speed lost a tick, so half in 2 ticks, then the move.
      expect.objectContaining({ x: 7, y: 7, vx: 1, vy: 0, age: 2 }),
    ]);
  });

  it('never turns a particle back by drag over a long frame', () => {
    const particles = system();
    particles.emit({ ...STRAIGHT, drag: 0.5 }, 0, 0);

    particles.update(3);

    expect(all(particles)[0]).toMatchObject({ x: 0, vx: 0 });
  });

  it('frees a particle at the end of its life and gives its place to the next', () => {
    const particles = system(2);
    particles.emit(STRAIGHT, 0, 0);
    particles.emit({ ...STRAIGHT, life: { min: 20, max: 20 } }, 0, 0);

    particles.update(9.5);
    expect(particles.count).toBe(2);
    particles.update(0.5);

    expect(particles.count).toBe(1);
    // The survivor took the freed place and still aged with the rest in that update.
    expect(all(particles)[0]).toMatchObject({ life: 20, age: 10 });
    expect(particles.emit(STRAIGHT, 0, 0)).toBe(1);
  });

  it('stands still for no time', () => {
    const particles = system();
    particles.emit(STRAIGHT, 5, 7);

    particles.update(0);
    particles.update(-1);

    expect(all(particles)[0]).toMatchObject({ x: 5, age: 0 });
  });

  it('clears every particle', () => {
    const particles = system();
    particles.emit({ ...STRAIGHT, count: 5 }, 0, 0);

    particles.clear();

    expect(particles.count).toBe(0);
  });

  it('reuses the particles it made at the start', () => {
    const particles = system(8);
    particles.emit({ ...STRAIGHT, count: 8 }, 0, 0);
    const first = new Set(all(particles));

    for (let round = 0; round < 5; round += 1) {
      particles.update(10);
      particles.emit({ ...STRAIGHT, count: 8 }, 0, 0);
    }

    expect(all(particles).every((particle) => first.has(particle))).toBe(true);
  });

  it('rejects a capacity that is not a whole number of at least 1', () => {
    expect(() => createParticleSystem({ capacity: 0, rng: createRng(1) })).toThrow(RangeError);
    expect(() => createParticleSystem({ capacity: 1.5, rng: createRng(1) })).toThrow(RangeError);
  });

  it.each([
    ['a negative amount', -1, 1],
    ['an amount that is not a number', Number.NaN, 1],
    ['an endless amount', Number.POSITIVE_INFINITY, 1],
    ['no life', 1, 0],
    ['an endless life', 1, Number.POSITIVE_INFINITY],
  ])('rejects %s', (_, amount, lifeScale) => {
    expect(() => system().emit(STRAIGHT, 0, 0, amount, lifeScale)).toThrow(RangeError);
  });

  test.prop(
    [
      fc.array(
        fc.oneof(
          fc.record({
            emit: fc.integer({ min: 0, max: 12 }),
            amount: fc.double({ min: 0, max: 2, noNaN: true }),
          }),
          fc.record({ update: fc.double({ min: 0, max: 15, noNaN: true }) }),
        ),
        { maxLength: 60 },
      ),
    ],
    { numRuns: 100 },
  )('holds no more than its capacity, and only particles with life left', (steps) => {
    const particles = createParticleSystem<Style>({ capacity: 24, rng: createRng(7) });
    const burst = defineParticleBurst<Style>({
      ...STRAIGHT,
      speed: { min: 0, max: 4 },
      spread: 2 * Math.PI,
      life: { min: 1, max: 12 },
    });

    for (const step of steps) {
      if ('update' in step) {
        particles.update(step.update);
      } else {
        particles.emit({ ...burst, count: step.emit }, 0, 0, step.amount);
      }
      expect(particles.count).toBeLessThanOrEqual(24);
      expect(all(particles).every(({ age, life }) => age < life)).toBe(true);
    }
  });
});

describe('defineParticleBurst', () => {
  it('returns a valid burst as it is', () => {
    expect(defineParticleBurst(STRAIGHT)).toBe(STRAIGHT);
  });

  it.each<[string, Partial<ParticleBurst<Style>>]>([
    ['a negative count', { count: -1 }],
    ['a speed range upside down', { speed: { min: 3, max: 1 } }],
    ['a negative speed', { speed: { min: -1, max: 1 } }],
    ['a life of no time', { life: { min: 0, max: 5 } }],
    ['a life range upside down', { life: { min: 9, max: 5 } }],
    ['a negative size', { size: { min: -1, max: 2 } }],
    ['a negative end size', { endSize: -0.5 }],
    ['a spread past a whole turn', { spread: 7 }],
    ['a negative spread', { spread: -0.1 }],
    ['a drag of the whole speed', { drag: 1 }],
    ['a negative drag', { drag: -0.1 }],
    ['a direction that is not a number', { direction: Number.NaN }],
    // The type already asks for a color; the check is for data that bypassed the types.
    ['no colors', { colors: [] as unknown as ParticleBurst<Style>['colors'] }],
  ])('rejects %s', (_, change) => {
    expect(() => defineParticleBurst({ ...STRAIGHT, ...change })).toThrow(RangeError);
  });
});
