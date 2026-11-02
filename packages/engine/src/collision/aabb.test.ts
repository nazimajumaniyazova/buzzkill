// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import { type Aabb, aabbOverlaps, boxesOverlap } from './aabb';

const box = fc.record<Aabb>({
  x: fc.integer({ min: -100, max: 100 }),
  y: fc.integer({ min: -100, max: 100 }),
  width: fc.integer({ min: 0, max: 50 }),
  height: fc.integer({ min: 0, max: 50 }),
});

describe('aabbOverlaps', () => {
  it('detects boxes that share area and ignores boxes that only touch', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };

    expect(aabbOverlaps(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(aabbOverlaps(a, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
    expect(aabbOverlaps(a, { x: 0, y: 10, width: 10, height: 10 })).toBe(false);
    expect(aabbOverlaps(a, { x: 11, y: 11, width: 10, height: 10 })).toBe(false);
  });

  it('treats a box with no area as a point: inside counts, an edge and itself do not', () => {
    const point = { x: 5, y: 5, width: 0, height: 0 };
    const box10 = { x: 0, y: 0, width: 10, height: 10 };

    expect(aabbOverlaps(point, box10)).toBe(true);
    expect(aabbOverlaps({ x: 10, y: 5, width: 0, height: 0 }, box10)).toBe(false);
    expect(aabbOverlaps(point, point)).toBe(false);
  });

  test.prop([box, box])('is symmetric', (a, b) => {
    expect(aabbOverlaps(a, b)).toBe(aabbOverlaps(b, a));
  });

  test.prop([box])('a box with area overlaps itself', (a) => {
    expect(aabbOverlaps(a, a)).toBe(a.width > 0 && a.height > 0);
  });

  test.prop([box, box])('agrees with the raw-number form', (a, b) => {
    expect(boxesOverlap(a.x, a.y, a.width, a.height, b.x, b.y, b.width, b.height)).toBe(
      aabbOverlaps(a, b),
    );
  });
});
