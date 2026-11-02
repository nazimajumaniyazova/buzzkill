import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GameCanvas } from './GameCanvas';

const legacy = vi.hoisted(() => ({
  construct: vi.fn(),
  update: vi.fn(),
  draw: vi.fn(),
  gameOver: false,
}));

vi.mock('@buzzkill/game/legacy', () => ({
  Game: class {
    constructor(width: number, height: number, hero: string, settings: unknown) {
      legacy.construct(width, height, hero, settings);
    }
    get gameOver(): boolean {
      return legacy.gameOver;
    }
    update = legacy.update;
    draw = legacy.draw;
  },
}));

const settings = { mode: 'day', volume: 0.3 } as const;
const context = { clearRect: vi.fn(), setTransform: vi.fn() };

/**
 * Runs one animation frame per timer tick so tests can await the next frame. Timestamps grow by
 * 20 ms, a value exact in floating point, so every frame after the first yields at least one tick.
 */
function installFrameLoop(): void {
  let timeMs = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
    return window.setTimeout(() => {
      timeMs += 20;
      callback(timeMs);
    }, 0);
  });
  vi.stubGlobal('cancelAnimationFrame', (handle: number): void => {
    window.clearTimeout(handle);
  });
}

/** jsdom exposes the window metrics as plain writable properties. */
function setViewport(width: number, height: number, devicePixelRatio = 1): void {
  window.innerWidth = width;
  window.innerHeight = height;
  window.devicePixelRatio = devicePixelRatio;
}

describe('GameCanvas', () => {
  beforeEach(() => {
    legacy.gameOver = false;
    legacy.construct.mockClear();
    legacy.update.mockClear();
    legacy.draw.mockClear();
    context.clearRect.mockClear();
    context.setTransform.mockClear();
    setViewport(1024, 768);
    installFrameLoop();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      // jsdom has no canvas implementation; the loop only clears and sets the transform.
      context as unknown as CanvasRenderingContext2D,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('starts the legacy game at the window size and drives its loop', async () => {
    render(<GameCanvas hero="male" settings={settings} />);

    expect(legacy.construct).toHaveBeenCalledWith(1024, 768, 'male', settings);
    await vi.waitFor(() => {
      expect(legacy.draw).toHaveBeenCalled();
      expect(legacy.update).toHaveBeenCalled();
    });
    expect(legacy.update).toHaveBeenLastCalledWith(1000 / 60);
    expect(context.clearRect).toHaveBeenLastCalledWith(0, 0, 1024, 768);
    expect(screen.getByText('Buzzkill game screen')).toBeInTheDocument();
  });

  it('sizes the backing store for the device pixel ratio and draws scaled', async () => {
    setViewport(1024, 768, 2);
    render(<GameCanvas hero="male" settings={settings} />);
    const canvas = screen.getByText('Buzzkill game screen');

    expect(canvas).toHaveAttribute('width', '2048');
    expect(canvas).toHaveAttribute('height', '1536');
    expect(canvas).toHaveStyle({ width: '1024px', height: '768px' });
    await vi.waitFor(() => {
      expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    });
  });

  it('letterboxes the game when the window changes shape instead of stretching it', () => {
    render(<GameCanvas hero="male" settings={settings} />);
    const canvas = screen.getByText('Buzzkill game screen');

    setViewport(512, 768);
    window.dispatchEvent(new Event('resize'));

    expect(canvas).toHaveStyle({ width: '512px', height: '384px' });
    expect(canvas).toHaveAttribute('width', '512');
    expect(canvas).toHaveAttribute('height', '384');
    // The game itself keeps the size it was built for.
    expect(legacy.construct).toHaveBeenCalledTimes(1);
  });

  it('offers to play again once the game is over', async () => {
    legacy.gameOver = true;
    render(<GameCanvas hero="female" settings={settings} />);

    expect(await screen.findByRole('status')).toHaveTextContent('Game over');
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument();
  });

  it('explains when the browser has no 2D canvas context', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    render(<GameCanvas hero="male" settings={settings} />);

    expect(screen.getByRole('alert')).toHaveTextContent('canvas');
    expect(legacy.construct).not.toHaveBeenCalled();
  });
});
