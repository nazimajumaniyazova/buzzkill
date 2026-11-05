import { describe, expect, it } from 'vitest';

import { createGridAtlas } from './atlas';

describe('createGridAtlas', () => {
  it('lays a strip of frames out in one row by default', () => {
    const atlas = createGridAtlas('sheet', { frameWidth: 10, frameHeight: 20, frames: 3 });

    expect(atlas.image).toBe('sheet');
    expect(atlas.frames).toEqual([
      { x: 0, y: 0, width: 10, height: 20 },
      { x: 10, y: 0, width: 10, height: 20 },
      { x: 20, y: 0, width: 10, height: 20 },
    ]);
  });

  it('wraps frames into rows of the given number of columns', () => {
    const atlas = createGridAtlas('sheet', {
      frameWidth: 8,
      frameHeight: 8,
      frames: 5,
      columns: 2,
    });

    expect(atlas.frames.map(({ x, y }) => [x, y])).toEqual([
      [0, 0],
      [8, 0],
      [0, 8],
      [8, 8],
      [0, 16],
    ]);
  });

  it.each([
    { frameWidth: 0, frameHeight: 8, frames: 1 },
    { frameWidth: 8, frameHeight: Number.NaN, frames: 1 },
    { frameWidth: 8, frameHeight: 8, frames: 0 },
    { frameWidth: 8, frameHeight: 8, frames: 1.5 },
    { frameWidth: 8, frameHeight: 8, frames: 2, columns: 0 },
  ])('rejects %o', (options) => {
    expect(() => createGridAtlas('sheet', options)).toThrow(RangeError);
  });
});
