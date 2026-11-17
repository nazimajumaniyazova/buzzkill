import type { SpriteAtlas } from './atlas';
import type { Camera } from './screen-shake';

/**
 * The drawing interface of the engine (ADR-0004). Game code draws through it and never calls
 * `drawImage` itself, so a WebGL renderer could replace the Canvas 2D one without touching the
 * game. Coordinates are logical pixels of the play area; the renderer maps them to the canvas.
 */
export interface Renderer<TImage> {
  /** The logical size of the play area. */
  readonly width: number;
  readonly height: number;
  /** Device pixels per logical pixel, from `computeCanvasFit`. Takes effect at the next frame. */
  setScale(scale: number): void;
  /**
   * Clears the canvas and starts counting the frame's draws. The frame is drawn through `camera`,
   * moved, turned and zoomed about the center of the play area, such as by a screen shake (#157);
   * without one, as it is.
   */
  beginFrame(camera?: Camera): void;
  /**
   * Draws frame `frame` of `atlas` with its top-left corner at (`x`, `y`). Size defaults to the
   * frame's size. A sprite entirely outside the play area is skipped.
   */
  drawSprite(
    atlas: SpriteAtlas<TImage>,
    frame: number,
    x: number,
    y: number,
    options?: SpriteOptions,
  ): void;
  /**
   * Fills a rectangle, at an opacity from 0 to 1 (1 by default): health bars, warnings and
   * particles (#156).
   */
  fillRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    alpha?: number,
  ): void;
  drawText(text: string, x: number, y: number, style: TextStyle): void;
  /** Ends the frame and returns its counts. The object is reused by the next frame. */
  endFrame(): RenderStats;
}

export interface SpriteOptions {
  readonly width?: number;
  readonly height?: number;
  /** Opacity from 0 to 1. */
  readonly alpha?: number;
  /**
   * A color to mix into the sprite's own pixels, such as white for a flash on a hit (#159). The
   * renderer tints the same frame on its tint buffer, so no second sprite is needed; without a
   * buffer the sprite is drawn as it is.
   */
  readonly tint?: string;
  /** How much of `tint`, from 0, none, to 1, the color alone. 1 by default. */
  readonly tintAmount?: number;
}

export interface TextStyle {
  /** A CSS font, for example `bold 24px system-ui`. */
  readonly font: string;
  readonly color: string;
  readonly align?: 'left' | 'center' | 'right';
  readonly baseline?: 'top' | 'middle' | 'alphabetic' | 'bottom';
}

export interface RenderStats {
  /** Sprites drawn in the frame. */
  readonly sprites: number;
  /** Sprites skipped because they were outside the play area. */
  readonly culled: number;
}

/**
 * The part of `CanvasRenderingContext2D` the renderer uses, typed without the DOM lib so that the
 * engine core stays headless. Both `CanvasRenderingContext2D` and
 * `OffscreenCanvasRenderingContext2D` satisfy it with `TImage = CanvasImageSource`.
 */
export interface Context2DLike<TImage> {
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  clearRect(x: number, y: number, width: number, height: number): void;
  fillRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number): void;
  drawImage(
    image: TImage,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
  // `unknown` because the DOM types also allow gradients and patterns here; this code writes
  // only strings.
  fillStyle: unknown;
  globalAlpha: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  globalCompositeOperation: string;
}

/**
 * A scratch canvas the renderer tints a sprite on before it draws it (#159): `source-atop` paints
 * the color over the sprite's own pixels only, which the main canvas cannot do over the scene.
 */
export interface TintBuffer<TImage> {
  readonly context: Context2DLike<TImage>;
  /** The scratch canvas itself, which the main context draws from. */
  readonly image: TImage;
  /** Makes the canvas at least this many pixels wide and high; it never shrinks. */
  ensureSize(width: number, height: number): void;
}

export interface Canvas2DRendererOptions<TImage = unknown> {
  /** Logical size of the play area. */
  readonly width: number;
  readonly height: number;
  /** Initial device pixels per logical pixel. Default 1. */
  readonly scale?: number;
  /** Where tinted sprites are made; without one, a tint is ignored. */
  readonly tintBuffer?: TintBuffer<TImage>;
}

/**
 * The Canvas 2D implementation of `Renderer` (ADR-0004). Positions are snapped to whole device
 * pixels, so sprites stay sharp and do not shimmer while they move by fractions of a pixel.
 */
export function createCanvas2DRenderer<TImage>(
  context: Context2DLike<TImage>,
  options: Canvas2DRendererOptions<TImage>,
): Renderer<TImage> {
  const { width, height, tintBuffer } = options;
  let scale = options.scale ?? 1;
  const stats = { sprites: 0, culled: 0 };

  const assertScale = (value: number): void => {
    if (!(value > 0) || !Number.isFinite(value)) {
      throw new RangeError(
        `Canvas2DRenderer: scale must be a positive number, got ${String(value)}`,
      );
    }
  };
  assertScale(scale);

  /** Rounds a logical coordinate to the nearest whole device pixel. */
  const snap = (value: number): number => Math.round(value * scale) / scale;

  return {
    width,
    height,
    setScale(value) {
      assertScale(value);
      scale = value;
    },
    beginFrame(camera) {
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, width, height);
      if (
        camera !== undefined &&
        (camera.x !== 0 || camera.y !== 0 || camera.angle !== 0 || camera.zoom !== 1)
      ) {
        // A point p of the scene goes to center + zoom × rotate(p - center) + offset, in device
        // pixels.
        const cos = Math.cos(camera.angle) * camera.zoom;
        const sin = Math.sin(camera.angle) * camera.zoom;
        const centerX = width / 2;
        const centerY = height / 2;
        context.setTransform(
          scale * cos,
          scale * sin,
          -scale * sin,
          scale * cos,
          scale * (centerX + camera.x - (cos * centerX - sin * centerY)),
          scale * (centerY + camera.y - (sin * centerX + cos * centerY)),
        );
      }
      context.globalAlpha = 1;
      stats.sprites = 0;
      stats.culled = 0;
    },
    drawSprite(atlas, frame, x, y, spriteOptions) {
      const rect = atlas.frames[frame];
      if (rect === undefined) {
        throw new RangeError(
          `drawSprite: frame ${String(frame)} is outside an atlas of ${String(atlas.frames.length)}`,
        );
      }
      const drawWidth = spriteOptions?.width ?? rect.width;
      const drawHeight = spriteOptions?.height ?? rect.height;
      if (x >= width || y >= height || x + drawWidth <= 0 || y + drawHeight <= 0) {
        stats.culled += 1;
        return;
      }
      const alpha = spriteOptions?.alpha ?? 1;
      if (alpha !== 1) {
        context.globalAlpha = alpha;
      }
      const tint = spriteOptions?.tint;
      const tintAmount = spriteOptions?.tintAmount ?? 1;
      if (tint !== undefined && tintAmount > 0 && tintBuffer !== undefined) {
        // The frame at its size on screen in device pixels, its own pixels then painted over.
        const bufferWidth = Math.ceil(drawWidth * scale);
        const bufferHeight = Math.ceil(drawHeight * scale);
        tintBuffer.ensureSize(bufferWidth, bufferHeight);
        const buffer = tintBuffer.context;
        buffer.setTransform(1, 0, 0, 1, 0, 0);
        buffer.globalCompositeOperation = 'source-over';
        buffer.globalAlpha = 1;
        buffer.clearRect(0, 0, bufferWidth, bufferHeight);
        buffer.drawImage(
          atlas.image,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          0,
          0,
          bufferWidth,
          bufferHeight,
        );
        buffer.globalCompositeOperation = 'source-atop';
        buffer.globalAlpha = tintAmount;
        buffer.fillStyle = tint;
        buffer.fillRect(0, 0, bufferWidth, bufferHeight);
        buffer.globalCompositeOperation = 'source-over';
        buffer.globalAlpha = 1;
        context.drawImage(
          tintBuffer.image,
          0,
          0,
          bufferWidth,
          bufferHeight,
          snap(x),
          snap(y),
          drawWidth,
          drawHeight,
        );
      } else {
        context.drawImage(
          atlas.image,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          snap(x),
          snap(y),
          drawWidth,
          drawHeight,
        );
      }
      if (alpha !== 1) {
        context.globalAlpha = 1;
      }
      stats.sprites += 1;
    },
    fillRect(x, y, rectWidth, rectHeight, color, alpha = 1) {
      context.fillStyle = color;
      if (alpha !== 1) {
        context.globalAlpha = alpha;
      }
      context.fillRect(snap(x), snap(y), rectWidth, rectHeight);
      if (alpha !== 1) {
        context.globalAlpha = 1;
      }
    },
    drawText(text, x, y, style) {
      context.font = style.font;
      context.fillStyle = style.color;
      context.textAlign = style.align ?? 'left';
      context.textBaseline = style.baseline ?? 'alphabetic';
      context.fillText(text, snap(x), snap(y));
    },
    endFrame() {
      return stats;
    },
  };
}
