// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it, vi } from 'vitest';

import { createPool } from './object-pool';

interface Particle {
  id: number;
  x: number;
}

function particlePool(capacity: number) {
  const reset = vi.fn((particle: Particle) => {
    particle.x = 0;
  });
  const pool = createPool<Particle>({ capacity, create: (id) => ({ id, x: 0 }), reset });
  return { pool, reset };
}

describe('createPool', () => {
  it('creates every item up front and hands them out until exhausted', () => {
    const create = vi.fn((index: number): Particle => ({ id: index, x: 0 }));
    const pool = createPool({ capacity: 3, create });
    expect(create).toHaveBeenCalledTimes(3);

    const taken = [pool.acquire(), pool.acquire(), pool.acquire()];

    expect(taken.map((particle) => particle?.id)).toEqual([0, 1, 2]);
    expect(pool.acquire()).toBeUndefined();
    expect(pool.active).toBe(3);
    expect(pool.available).toBe(0);
    expect(create).toHaveBeenCalledTimes(3);
  });

  it('resets a released item and hands it out again instead of allocating', () => {
    const { pool, reset } = particlePool(2);
    const first = pool.acquire() as Particle;
    first.x = 42;

    pool.release(first);

    expect(reset).toHaveBeenCalledWith(first);
    expect(first.x).toBe(0);
    expect(pool.active).toBe(0);
    expect(pool.acquire()).toBe(first);
  });

  it('keeps the active items in [0, active) by moving the last one into the freed slot', () => {
    const { pool } = particlePool(4);
    const a = pool.acquire() as Particle;
    const b = pool.acquire() as Particle;
    const c = pool.acquire() as Particle;

    pool.release(a);

    expect(pool.active).toBe(2);
    expect([pool.at(0), pool.at(1)]).toEqual([c, b]);
    expect(() => pool.at(2)).toThrow(RangeError);
    expect(() => pool.at(-1)).toThrow(RangeError);
  });

  it('lets a backwards loop release items while iterating', () => {
    const { pool } = particlePool(5);
    for (let i = 0; i < 5; i += 1) {
      const particle = pool.acquire() as Particle;
      particle.x = i;
    }

    for (let index = pool.active - 1; index >= 0; index -= 1) {
      const particle = pool.at(index);
      if (particle.x % 2 === 0) {
        pool.release(particle);
      }
    }

    const remaining = Array.from({ length: pool.active }, (_, index) => pool.at(index).x);
    expect(remaining.sort((left, right) => left - right)).toEqual([1, 3]);
  });

  it('releases everything at once with reset on each item', () => {
    const { pool, reset } = particlePool(3);
    pool.acquire();
    pool.acquire();

    pool.releaseAll();

    expect(pool.active).toBe(0);
    expect(pool.available).toBe(3);
    expect(reset).toHaveBeenCalledTimes(2);
  });

  it('rejects foreign items, double releases and bad options', () => {
    const { pool } = particlePool(2);
    const item = pool.acquire() as Particle;
    pool.release(item);

    expect(() => {
      pool.release(item);
    }).toThrow(/not acquired/);
    expect(() => {
      pool.release({ id: 99, x: 0 });
    }).toThrow(/does not belong/);
    expect(() => createPool({ capacity: 0, create: () => ({}) })).toThrow(RangeError);
    expect(() => createPool({ capacity: 1.5, create: () => ({}) })).toThrow(RangeError);
    const shared = {};
    expect(() => createPool({ capacity: 2, create: () => shared })).toThrow(/same item twice/);
  });

  test.prop([fc.integer({ min: 1, max: 8 }), fc.array(fc.boolean(), { maxLength: 60 })])(
    'never loses or duplicates an item, whatever the acquire and release sequence',
    (capacity, steps) => {
      const { pool } = particlePool(capacity);
      const held: Particle[] = [];

      for (const acquire of steps) {
        if (acquire) {
          const item = pool.acquire();
          if (item !== undefined) {
            held.push(item);
          }
        } else if (held.length > 0) {
          pool.release(held.pop() as Particle);
        }
        expect(pool.active).toBe(held.length);
        expect(pool.active + pool.available).toBe(capacity);
        const active = Array.from({ length: pool.active }, (_, index) => pool.at(index));
        expect(new Set(active).size).toBe(active.length);
        expect(new Set(active)).toEqual(new Set(held));
      }
    },
  );
});
