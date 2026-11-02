/**
 * Sizing a canvas for the screen it is on. Two things go wrong when a canvas is simply stretched
 * to the window: on a high-density display one canvas pixel covers several device pixels and the
 * image blurs, and when the window's aspect ratio differs from the game's the image distorts. The
 * fit computed here letterboxes the game's logical size into the viewport and gives the backing
 * store one pixel per device pixel, up to a cap.
 */

export interface Size {
  readonly width: number;
  readonly height: number;
}

function assertSize(size: Size, what: string, allowZero: boolean): void {
  const lowest = allowZero ? 0 : Number.MIN_VALUE;
  if (
    !Number.isFinite(size.width) ||
    !Number.isFinite(size.height) ||
    size.width < lowest ||
    size.height < lowest
  ) {
    throw new RangeError(
      `${what} must be finite and ${allowZero ? '>= 0' : '> 0'}, got ${String(size.width)} x ${String(size.height)}`,
    );
  }
}

/** The largest size with the aspect ratio of `content` that fits inside `container`. */
export function fitContain(content: Size, container: Size): Size {
  assertSize(content, 'fitContain: content', false);
  assertSize(container, 'fitContain: container', true);
  const scale = Math.min(container.width / content.width, container.height / content.height);
  return { width: content.width * scale, height: content.height * scale };
}

export interface CanvasFitOptions {
  /** Size of the drawing in logical pixels: the coordinate space the game draws in. */
  readonly logical: Size;
  /** Space available to the canvas, in CSS pixels. */
  readonly viewport: Size;
  /** `window.devicePixelRatio`. */
  readonly devicePixelRatio: number;
  /**
   * Cap on the ratio. Default 2: a 3x phone would pay triple the fill cost per frame for detail
   * that a moving sprite never shows.
   */
  readonly maxDevicePixelRatio?: number;
}

export interface CanvasFit {
  /** CSS size of the element: the logical size letterboxed into the viewport. */
  readonly cssWidth: number;
  readonly cssHeight: number;
  /** Backing store size in device pixels (the `width` and `height` attributes). */
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  /**
   * Multiplies logical coordinates into backing store pixels; apply it with
   * `context.setTransform(scale, 0, 0, scale, 0, 0)` before drawing.
   */
  readonly scale: number;
}

/**
 * Computes the letterboxed CSS size and the backing store for a logical drawing size.
 *
 * The backing store is a whole number of device pixels and the CSS size follows from it exactly,
 * so the canvas never lands on a half pixel. Sizes are floored, never rounded up, so the result
 * always fits the viewport. A viewport of zero size yields a 1 by 1 store.
 */
export function computeCanvasFit(options: CanvasFitOptions): CanvasFit {
  const { logical, viewport, devicePixelRatio, maxDevicePixelRatio = 2 } = options;
  assertSize(logical, 'computeCanvasFit: logical', false);
  assertSize(viewport, 'computeCanvasFit: viewport', true);
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
    throw new RangeError(
      `computeCanvasFit: devicePixelRatio must be > 0, got ${String(devicePixelRatio)}`,
    );
  }
  if (!Number.isFinite(maxDevicePixelRatio) || maxDevicePixelRatio <= 0) {
    throw new RangeError(
      `computeCanvasFit: maxDevicePixelRatio must be > 0, got ${String(maxDevicePixelRatio)}`,
    );
  }

  const ratio = Math.min(devicePixelRatio, maxDevicePixelRatio);
  const css = fitContain(logical, viewport);
  const pixelWidth = Math.max(1, Math.floor(css.width * ratio));
  const scale = pixelWidth / logical.width;
  const pixelHeight = Math.max(1, Math.floor(logical.height * scale));

  return {
    cssWidth: pixelWidth / ratio,
    cssHeight: pixelHeight / ratio,
    pixelWidth,
    pixelHeight,
    scale,
  };
}

/** The part of `HTMLCanvasElement` that a fit touches, so tests can pass a plain object. */
export interface CanvasLike {
  width: number;
  height: number;
  readonly style: { width: string; height: string };
}

/**
 * Applies a fit: backing store attributes and CSS size. Setting `width` or `height` wipes the
 * canvas even when the value does not change, so they are written only when they differ.
 */
export function applyCanvasFit(canvas: CanvasLike, fit: CanvasFit): void {
  if (canvas.width !== fit.pixelWidth) {
    canvas.width = fit.pixelWidth;
  }
  if (canvas.height !== fit.pixelHeight) {
    canvas.height = fit.pixelHeight;
  }
  canvas.style.width = `${String(fit.cssWidth)}px`;
  canvas.style.height = `${String(fit.cssHeight)}px`;
}
