import { describe, test } from 'vitest';

import { createRng } from '../math/rng';
import { boxesOverlap } from './aabb';
import { createSpatialHash } from './spatial-hash';

/**
 * Broad-phase cost at the entity counts of ADR-0003 (50 / 200 / 1000): the spatial hash, including
 * re-inserting every box as a tick would, against the naive all-pairs loop. Run with `pnpm bench`.
 */

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 1000;

/** Deterministic random boxes (x, y, width, height per entity) so runs are comparable. */
function makeBoxes(count: number): Float64Array {
  const rng = createRng(1);
  const boxes = new Float64Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    boxes[i * 4] = rng.nextInt(0, WORLD_WIDTH);
    boxes[i * 4 + 1] = rng.nextInt(0, WORLD_HEIGHT);
    boxes[i * 4 + 2] = rng.nextInt(16, 64);
    boxes[i * 4 + 3] = rng.nextInt(16, 64);
  }
  return boxes;
}

// Every index below is within the array built for `count` boxes.
function naivePairs(boxes: Float64Array, count: number, out: number[]): number {
  let pairs = 0;
  for (let a = 0; a < count; a += 1) {
    for (let b = a + 1; b < count; b += 1) {
      if (
        boxesOverlap(
          boxes[a * 4] as number,
          boxes[a * 4 + 1] as number,
          boxes[a * 4 + 2] as number,
          boxes[a * 4 + 3] as number,
          boxes[b * 4] as number,
          boxes[b * 4 + 1] as number,
          boxes[b * 4 + 2] as number,
          boxes[b * 4 + 3] as number,
        )
      ) {
        out[pairs * 2] = a;
        out[pairs * 2 + 1] = b;
        pairs += 1;
      }
    }
  }
  return pairs;
}

describe('broad phase', () => {
  for (const count of [50, 200, 1000]) {
    test(`${String(count)} boxes`, async ({ bench }) => {
      const boxes = makeBoxes(count);
      const hash = createSpatialHash({ cellSize: 64, capacity: count });
      const out: number[] = [];

      await bench.compare(
        bench('spatial hash: clear, insert all, pairs', () => {
          hash.clear();
          for (let i = 0; i < count; i += 1) {
            hash.insert(
              i,
              boxes[i * 4] as number,
              boxes[i * 4 + 1] as number,
              boxes[i * 4 + 2] as number,
              boxes[i * 4 + 3] as number,
            );
          }
          hash.pairs(out);
        }),
        bench('naive all pairs', () => {
          naivePairs(boxes, count, out);
        }),
      );
    });
  }
});
