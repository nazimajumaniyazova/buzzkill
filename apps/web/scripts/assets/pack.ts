/** A sprite to pack: equal frames of one size. */
export interface PackSprite<N extends string = string> {
  readonly name: N;
  readonly width: number;
  readonly height: number;
  readonly frames: number;
}

/** Where one frame of a sprite sits in the atlas, in atlas pixels. */
export interface Placement<N extends string = string> {
  readonly name: N;
  readonly frame: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PackedAtlas<N extends string = string> {
  readonly width: number;
  readonly height: number;
  /** Every frame of every sprite, a sprite's frames in order. */
  readonly placements: readonly Placement<N>[];
}

export interface PackOptions {
  /** The largest width and height of the atlas. */
  readonly maxSize: number;
  /** Transparent pixels between frames, so smoothing never samples a neighbor's edge. */
  readonly padding: number;
}

/**
 * Packs the frames into shelves: rows filled left to right, the tallest sprites first, each row as
 * tall as its tallest frame. Simple and deterministic: the same sprites give the same atlas in any
 * order, so the generated manifest only changes when the art does.
 */
export function packShelves<N extends string>(
  sprites: readonly PackSprite<N>[],
  options: PackOptions,
): PackedAtlas<N> {
  const { maxSize, padding } = options;
  const ordered = sprites.toSorted((a, b) => b.height - a.height || compare(a.name, b.name));
  const placements: Placement<N>[] = [];
  let x = 0;
  let y = 0;
  let shelfHeight = 0;
  let width = 0;

  for (const sprite of ordered) {
    if (sprite.width > maxSize) {
      throw new RangeError(
        `packShelves: ${sprite.name} is ${String(sprite.width)} px wide, more than ${String(maxSize)}`,
      );
    }
    for (let frame = 0; frame < sprite.frames; frame += 1) {
      if (x > 0 && x + sprite.width > maxSize) {
        y += shelfHeight + padding;
        x = 0;
        shelfHeight = 0;
      }
      placements.push({
        name: sprite.name,
        frame,
        x,
        y,
        width: sprite.width,
        height: sprite.height,
      });
      width = Math.max(width, x + sprite.width);
      shelfHeight = Math.max(shelfHeight, sprite.height);
      x += sprite.width + padding;
    }
  }

  const height = y + shelfHeight;
  if (height > maxSize) {
    throw new RangeError(
      `packShelves: the atlas would be ${String(height)} px, taller than ${String(maxSize)}; split it`,
    );
  }
  return { width, height, placements };
}

/** Code-point order, the same on every machine, unlike `localeCompare`. */
function compare(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}
