/** A rectangle inside an atlas image, in image pixels. */
export interface FrameRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * One image holding many sprite frames. Sprites are drawn by atlas and frame index, never by
 * creating images in game code. `TImage` is whatever the renderer draws: an `ImageBitmap` in the
 * browser, a plain object in tests.
 */
export interface SpriteAtlas<TImage> {
  readonly image: TImage;
  readonly frames: readonly FrameRect[];
}

export interface GridAtlasOptions {
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frames: number;
  /** Frames per row; defaults to all of them in one row, as the 2023 sprite sheets are. */
  readonly columns?: number;
}

/**
 * Describes a sprite sheet of equal frames laid out in rows. Until the stage 6 asset pipeline
 * packs real atlases with a JSON manifest, every sheet of the game is such a grid.
 */
export function createGridAtlas<TImage>(
  image: TImage,
  options: GridAtlasOptions,
): SpriteAtlas<TImage> {
  const { frameWidth, frameHeight, frames } = options;
  const columns = options.columns ?? frames;
  if (!(frameWidth > 0) || !(frameHeight > 0)) {
    throw new RangeError(
      `createGridAtlas: frame size must be positive, got ${String(frameWidth)} x ${String(frameHeight)}`,
    );
  }
  if (!Number.isInteger(frames) || frames < 1 || !Number.isInteger(columns) || columns < 1) {
    throw new RangeError(
      `createGridAtlas: frames and columns must be whole numbers >= 1, got ${String(frames)} and ${String(columns)}`,
    );
  }
  return {
    image,
    frames: Array.from({ length: frames }, (_, index) => ({
      x: (index % columns) * frameWidth,
      y: Math.floor(index / columns) * frameHeight,
      width: frameWidth,
      height: frameHeight,
    })),
  };
}
