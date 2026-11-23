import {
  applyCanvasFit,
  computeCanvasFit,
  createCanvas2DRenderer,
  createCanvasTintBuffer,
  type GameLoopHost,
  type Renderer,
} from '@buzzkill/engine';
import { WORLD } from '@buzzkill/game';

import { suggestsLandscape } from './landscape';

/** The renderer of a canvas that follows the window, and the way to stop following it. */
export interface RunCanvas {
  readonly renderer: Renderer<CanvasImageSource>;
  /** Stops fitting the canvas to the window. */
  readonly dispose: () => void;
}

/**
 * The Canvas 2D renderer of the world on `canvas`, fitted to the window now and on every resize,
 * for a run and for a replay alike (#219). `onFit` hears after each fit whether the window would
 * show the world larger turned sideways.
 */
export function attachRunCanvas(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  onFit: (suggestLandscape: boolean) => void,
): RunCanvas {
  // A spare canvas where the renderer tints the sprite of a hit (#159).
  const tintBuffer = createCanvasTintBuffer<CanvasImageSource>(document.createElement('canvas'));
  const renderer = createCanvas2DRenderer(
    context,
    tintBuffer === null ? WORLD : { ...WORLD, tintBuffer },
  );
  const fit = (): void => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const result = computeCanvasFit({
      logical: WORLD,
      viewport,
      devicePixelRatio: window.devicePixelRatio,
    });
    applyCanvasFit(canvas, result);
    renderer.setScale(result.scale);
    onFit(suggestsLandscape(WORLD, viewport));
  };
  fit();
  window.addEventListener('resize', fit);
  return {
    renderer,
    dispose: () => {
      window.removeEventListener('resize', fit);
    },
  };
}

/**
 * The host with every frame's error handed to `onCrash` instead of thrown. A frame runs outside
 * React, where an error would stop the loop without a word; the view keeps it and throws it in its
 * next render, so the error boundary around it sees it (#113).
 */
export function catchingHost(host: GameLoopHost, onCrash: (error: unknown) => void): GameLoopHost {
  return {
    ...host,
    requestFrame: (callback) =>
      host.requestFrame((timeMs) => {
        try {
          callback(timeMs);
        } catch (error) {
          onCrash(error);
        }
      }),
  };
}
