// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { packShelves, type Placement } from './pack';

const OPTIONS = { maxSize: 100, padding: 2 };

function overlaps(a: Placement, b: Placement): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

describe('packShelves', () => {
  it('places every frame once, in frame order, without overlaps and inside the atlas', () => {
    const atlas = packShelves(
      [
        { name: 'tall', width: 30, height: 40, frames: 3 },
        { name: 'flat', width: 20, height: 10, frames: 2 },
      ],
      OPTIONS,
    );

    expect(atlas.placements.map((p) => [p.name, p.frame])).toEqual([
      ['tall', 0],
      ['tall', 1],
      ['tall', 2],
      ['flat', 0],
      ['flat', 1],
    ]);
    for (const [index, a] of atlas.placements.entries()) {
      expect(a.x + a.width).toBeLessThanOrEqual(atlas.width);
      expect(a.y + a.height).toBeLessThanOrEqual(atlas.height);
      for (const b of atlas.placements.slice(index + 1)) {
        expect(overlaps(a, b)).toBe(false);
      }
    }
  });

  it('fills a shelf left to right with padding, then opens the next one below the tallest frame', () => {
    const atlas = packShelves(
      [
        { name: 'tall', width: 30, height: 40, frames: 3 },
        { name: 'flat', width: 20, height: 10, frames: 2 },
      ],
      OPTIONS,
    );

    // 30 + 2 + 30 + 2 + 30 = 94 on the first shelf; a 20 px frame no longer fits in 100.
    expect(atlas.placements.map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [32, 0],
      [64, 0],
      [0, 42],
      [22, 42],
    ]);
    expect([atlas.width, atlas.height]).toEqual([94, 52]);
  });

  it('gives the same atlas whatever the order of the sprites', () => {
    const sprites = [
      { name: 'a', width: 10, height: 10, frames: 2 },
      { name: 'b', width: 12, height: 30, frames: 1 },
      { name: 'c', width: 14, height: 10, frames: 1 },
    ];

    expect(packShelves(sprites.toReversed(), OPTIONS)).toEqual(packShelves(sprites, OPTIONS));
  });

  it('refuses a frame wider than the atlas and an atlas taller than the limit', () => {
    expect(() =>
      packShelves([{ name: 'wide', width: 101, height: 10, frames: 1 }], OPTIONS),
    ).toThrow(RangeError);
    expect(() =>
      packShelves([{ name: 'many', width: 60, height: 40, frames: 3 }], OPTIONS),
    ).toThrow(/taller than 100/);
  });
});
