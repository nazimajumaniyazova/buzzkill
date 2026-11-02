// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import { type Aabb, aabbOverlaps } from './aabb';
import { createSpatialHash, type SpatialHash } from './spatial-hash';

const box = fc.record<Aabb>({
  x: fc.integer({ min: -200, max: 200 }),
  y: fc.integer({ min: -200, max: 200 }),
  width: fc.integer({ min: 0, max: 80 }),
  height: fc.integer({ min: 0, max: 80 }),
});
const boxes = fc.array(box, { maxLength: 40 });
const cellSize = fc.constantFrom(5, 32, 1000);

function fill(hash: SpatialHash, items: readonly Aabb[]): void {
  hash.clear();
  items.forEach((item, id) => {
    hash.insert(id, item.x, item.y, item.width, item.height);
  });
}

/** Overlapping pairs by brute force, as sorted "a-b" strings for easy comparison. */
function naivePairs(items: readonly Aabb[]): string[] {
  const result: string[] = [];
  for (let a = 0; a < items.length; a += 1) {
    for (let b = a + 1; b < items.length; b += 1) {
      if (aabbOverlaps(items[a] as Aabb, items[b] as Aabb)) {
        result.push(`${String(a)}-${String(b)}`);
      }
    }
  }
  return result.sort();
}

function hashedPairs(hash: SpatialHash): string[] {
  const out: number[] = [];
  const count = hash.pairs(out);
  const result: string[] = [];
  for (let i = 0; i < count; i += 1) {
    result.push(`${String(out[i * 2])}-${String(out[i * 2 + 1])}`);
  }
  return result.sort();
}

function hashedQuery(hash: SpatialHash, area: Aabb): number[] {
  const out: number[] = [];
  const count = hash.query(area.x, area.y, area.width, area.height, out);
  return out.slice(0, count).sort((a, b) => a - b);
}

describe('createSpatialHash', () => {
  it('finds the boxes overlapping a query area and ignores the ones that only touch', () => {
    const hash = createSpatialHash({ cellSize: 8, capacity: 4 });
    fill(hash, [
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 5, y: 5, width: 10, height: 10 },
      { x: 10, y: 0, width: 10, height: 10 },
      { x: 100, y: 100, width: 10, height: 10 },
    ]);

    expect(hashedQuery(hash, { x: 0, y: 0, width: 10, height: 10 })).toEqual([0, 1]);
    expect(hashedQuery(hash, { x: 50, y: 50, width: 10, height: 10 })).toEqual([]);
    expect(hash.size).toBe(4);
  });

  it('reports a box that spans many cells once', () => {
    const hash = createSpatialHash({ cellSize: 4, capacity: 1 });
    fill(hash, [{ x: 0, y: 0, width: 40, height: 40 }]);

    expect(hashedQuery(hash, { x: -10, y: -10, width: 60, height: 60 })).toEqual([0]);
  });

  it('writes results from index 0 and leaves the rest of the output array alone', () => {
    const hash = createSpatialHash({ cellSize: 8, capacity: 2 });
    fill(hash, [
      { x: 0, y: 0, width: 4, height: 4 },
      { x: 50, y: 50, width: 4, height: 4 },
    ]);
    const out = [9, 9, 9];

    const count = hash.query(0, 0, 4, 4, out);

    expect(count).toBe(1);
    expect(out).toEqual([0, 9, 9]);
  });

  it('lists each overlapping pair once, with the smaller id first', () => {
    const hash = createSpatialHash({ cellSize: 8, capacity: 4 });
    fill(hash, [
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 5, y: 5, width: 10, height: 10 },
      { x: 10, y: 0, width: 10, height: 10 },
      { x: 2, y: 2, width: 30, height: 30 },
    ]);

    expect(hashedPairs(hash)).toEqual(['0-1', '0-3', '1-2', '1-3', '2-3']);
  });

  test.prop([boxes, cellSize])('pairs agree with brute force', (items, size) => {
    const hash = createSpatialHash({ cellSize: size, capacity: Math.max(1, items.length) });
    fill(hash, items);

    expect(hashedPairs(hash)).toEqual(naivePairs(items));
  });

  test.prop([boxes, box, cellSize])('queries agree with brute force', (items, area, size) => {
    const hash = createSpatialHash({ cellSize: size, capacity: Math.max(1, items.length) });
    fill(hash, items);
    const expected = items
      .map((item, id) => (aabbOverlaps(area, item) ? id : -1))
      .filter((id) => id >= 0);

    expect(hashedQuery(hash, area)).toEqual(expected);
  });

  it('stays correct far from the origin, where cells are clamped', () => {
    const hash = createSpatialHash({ cellSize: 8, capacity: 3 });
    const far = 1e9;
    fill(hash, [
      { x: far, y: far, width: 10, height: 10 },
      { x: far + 5, y: far + 5, width: 10, height: 10 },
      { x: -far, y: far, width: 10, height: 10 },
    ]);

    expect(hashedPairs(hash)).toEqual(['0-1']);
    expect(hashedQuery(hash, { x: far + 8, y: far + 8, width: 1, height: 1 })).toEqual([0, 1]);
  });

  it('starts empty again after clear and lets ids be reused', () => {
    const hash = createSpatialHash({ cellSize: 8, capacity: 2 });
    fill(hash, [
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 5, y: 5, width: 10, height: 10 },
    ]);

    hash.clear();
    expect(hash.size).toBe(0);
    expect(hashedPairs(hash)).toEqual([]);

    hash.insert(0, 100, 100, 10, 10);
    expect(hashedQuery(hash, { x: 0, y: 0, width: 20, height: 20 })).toEqual([]);
    expect(hashedQuery(hash, { x: 100, y: 100, width: 1, height: 1 })).toEqual([0]);
  });

  test.prop([boxes])('produces the same pair order for the same inserts', (items) => {
    const first = createSpatialHash({ cellSize: 16, capacity: Math.max(1, items.length) });
    const second = createSpatialHash({ cellSize: 16, capacity: Math.max(1, items.length) });
    fill(first, items);
    fill(second, items);
    const outFirst: number[] = [];
    const outSecond: number[] = [];

    const count = first.pairs(outFirst);

    expect(second.pairs(outSecond)).toBe(count);
    expect(outSecond.slice(0, count * 2)).toEqual(outFirst.slice(0, count * 2));
  });

  it('rejects ids outside the capacity, repeated ids, bad boxes and bad options', () => {
    const hash = createSpatialHash({ cellSize: 8, capacity: 2 });
    hash.insert(0, 0, 0, 1, 1);

    expect(() => {
      hash.insert(2, 0, 0, 1, 1);
    }).toThrow(RangeError);
    expect(() => {
      hash.insert(0, 0, 0, 1, 1);
    }).toThrow(/already inserted/);
    expect(() => {
      hash.insert(1, Number.NaN, 0, 1, 1);
    }).toThrow(RangeError);
    expect(() => {
      hash.insert(1, 0, 0, -1, 1);
    }).toThrow(RangeError);
    expect(() => hash.query(0, 0, Number.POSITIVE_INFINITY, 1, [])).toThrow(RangeError);
    expect(() => createSpatialHash({ cellSize: 0, capacity: 1 })).toThrow(RangeError);
    expect(() => createSpatialHash({ cellSize: 8, capacity: 0 })).toThrow(RangeError);
  });
});
