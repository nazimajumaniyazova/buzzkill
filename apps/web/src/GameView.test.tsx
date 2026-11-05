import { type AudioMixer, createAudioMixer } from '@buzzkill/engine';
import type { GameSound } from '@buzzkill/game';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createGameSprites } from './game/sprites';
import { GameView } from './GameView';

// jsdom has no canvas: a context that accepts every call the renderer makes.
const context = {
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  drawImage: vi.fn(),
  fillStyle: '',
  globalAlpha: 1,
  font: '',
  textAlign: '',
  textBaseline: '',
};

const image = {} as ImageBitmap;
const sprites = createGameSprites<ImageBitmap>({
  'enemy-2': image,
  'enemy-3': image,
  enemy_bat_2: image,
  enemy_bat_3: image,
  enemy_raven: image,
  projectile: image,
  smokeExplosion: image,
  fireExplosion: image,
});

const choice = { heroId: 'male', mode: 'day', volume: 0.5 } as const;

/** One animation frame per timer turn, 50 ms apart: three ticks per frame. */
function installFrames(): { pending: () => number } {
  let timeMs = 0;
  let pending = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
    pending += 1;
    return window.setTimeout(() => {
      pending -= 1;
      timeMs += 50;
      callback(timeMs);
    }, 0);
  });
  vi.stubGlobal('cancelAnimationFrame', (handle: number): void => {
    pending -= 1;
    window.clearTimeout(handle);
  });
  return { pending: () => pending };
}

async function frames(count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await act(() => new Promise((resolve) => window.setTimeout(resolve, 0)));
  }
}

/** The value shown next to a HUD label: score, lives or ammo. */
function hudValue(name: 'Score' | 'Lives' | 'Ammo'): string | null {
  const values = within(screen.getByRole('region', { name: 'Game status' })).getAllByRole(
    'definition',
  );
  return values[['Score', 'Lives', 'Ammo'].indexOf(name)]?.textContent ?? null;
}

describe('GameView', () => {
  let audio: AudioMixer<GameSound>;
  let play: ReturnType<typeof vi.fn<AudioMixer<GameSound>['play']>>;

  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    play = vi.fn<AudioMixer<GameSound>['play']>();
    audio = { ...createAudioMixer({ context: null, buffers: {} }), play };
    window.history.replaceState(null, '', '/?seed=1');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  });

  it('runs the game on the canvas and shows its HUD', async () => {
    installFrames();
    render(<GameView choice={choice} sprites={sprites} audio={audio} onExit={vi.fn()} />);

    // The first frame sets the time reference, each later one runs three ticks: 6 ticks, before
    // the first round comes back at tick 12.
    await frames(3);

    expect(hudValue('Score')).toBe('0');
    expect(hudValue('Ammo')).toBe('20');
    // Every frame starts with the day sky.
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 1280, 720);
  });

  it('shoots on Space: a sound and one round less', async () => {
    installFrames();
    render(<GameView choice={choice} sprites={sprites} audio={audio} onExit={vi.fn()} />);
    await frames(1);

    fireEvent.keyDown(window, { code: 'Space' });
    await frames(2);
    fireEvent.keyUp(window, { code: 'Space' });

    expect(play).toHaveBeenCalledWith('shot');
    expect(hudValue('Ammo')).toBe('19');
  });

  it('pauses on Escape and resumes from the dialog', async () => {
    installFrames();
    render(<GameView choice={choice} sprites={sprites} audio={audio} onExit={vi.fn()} />);
    await frames(2);

    fireEvent.keyDown(window, { code: 'Escape' });
    await frames(2);
    fireEvent.keyUp(window, { code: 'Escape' });

    const resume = screen.getByRole('button', { name: 'Resume' });
    fireEvent.click(resume);
    await frames(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('starts a new run with Play again once the run is over', { timeout: 60_000 }, async () => {
    installFrames();
    render(<GameView choice={choice} sprites={sprites} audio={audio} onExit={vi.fn()} />);

    // Standing still, the hero is eventually hit five times.
    await screen.findByRole('dialog', { name: 'Game over' }, { timeout: 50_000, interval: 5 });
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    await frames(2);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(hudValue('Lives')).toBe('5 of 5');
  });

  it('stops the run when it leaves the page', async () => {
    const host = installFrames();
    const view = render(
      <GameView choice={choice} sprites={sprites} audio={audio} onExit={vi.fn()} />,
    );
    await frames(2);

    view.unmount();

    expect(host.pending()).toBe(0);
  });

  it('explains when the browser has no 2D canvas context', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    render(<GameView choice={choice} sprites={sprites} audio={audio} onExit={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('does not support the canvas element');
  });
});
