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
const context = { clearRect: vi.fn() };

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

describe('GameCanvas', () => {
  beforeEach(() => {
    legacy.gameOver = false;
    legacy.construct.mockClear();
    legacy.update.mockClear();
    legacy.draw.mockClear();
    installFrameLoop();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      // jsdom has no canvas implementation; only clearRect is used by the loop.
      context as unknown as CanvasRenderingContext2D,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('starts the legacy game on a canvas sized to the window and drives its loop', async () => {
    render(<GameCanvas hero="male" settings={settings} />);

    expect(legacy.construct).toHaveBeenCalledWith(
      window.innerWidth,
      window.innerHeight,
      'male',
      settings,
    );
    await vi.waitFor(() => {
      expect(legacy.draw).toHaveBeenCalled();
      expect(legacy.update).toHaveBeenCalled();
    });
    expect(screen.getByText('Buzzkill game screen')).toBeInTheDocument();
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
