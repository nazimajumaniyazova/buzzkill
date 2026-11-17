import type { Context2DLike, TintBuffer } from './renderer';

/**
 * The part of a canvas a tint buffer uses: `HTMLCanvasElement` and `OffscreenCanvas` both have
 * it, typed here without the DOM lib so that the engine core stays headless.
 */
export interface TintCanvas<TImage> {
  width: number;
  height: number;
  getContext(contextId: '2d'): Context2DLike<TImage> | null;
}

/**
 * Makes a tint buffer of a spare canvas (#159), which starts at one pixel and grows to the largest
 * sprite tinted on it. `null` when the canvas has no 2D context; the renderer then draws tinted
 * sprites as they are.
 */
export function createCanvasTintBuffer<TImage>(
  canvas: TintCanvas<TImage> & TImage,
): TintBuffer<TImage> | null {
  const context = canvas.getContext('2d');
  if (context === null) {
    return null;
  }
  canvas.width = 1;
  canvas.height = 1;
  return {
    context,
    image: canvas,
    ensureSize(width, height) {
      // Resizing a canvas clears it and resets its context, so it happens only to grow.
      const wide = Math.ceil(width);
      const high = Math.ceil(height);
      if (canvas.width < wide) {
        canvas.width = wide;
      }
      if (canvas.height < high) {
        canvas.height = high;
      }
    },
  };
}
