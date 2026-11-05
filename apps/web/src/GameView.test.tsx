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

/**
 * Animation frames that run only when the test says so, 50 ms apart: the first frame sets the
 * time reference and every later one runs three ticks. Timer-driven frames made the number of
 * ticks depend on the machine's speed.
 */
function installFrames() {
  let timeMs = 0;
  let nextHandle = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
    const handle = nextHandle;
    nextHandle += 1;
    callbacks.set(handle, callback);
    return handle;
  });
  vi.stubGlobal('cancelAnimationFrame', (handle: number): void => {
    callbacks.delete(handle);
  });
  return {
    pending: () => callbacks.size,
    run(count: number): void {
      act(() => {
        for (let i = 0; i < count; i += 1) {
          const due = [...callbacks.values()];
          callbacks.clear();
          timeMs += 50;
          for (const callback of due) {
            callback(timeMs);
          }
        }
      });
    },
  };
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

  it('runs the game on the canvas and shows its HUD', () => {
    const frames = installFrames();
    render(<GameView choice={choice} sprites={sprites} audio={audio} onExit={vi.fn()} />);

    // 6 ticks, before the first round comes back at tick 12.
    frames.run(3);

    expect(hudValue('Score')).toBe('0');
    expect(hudValue('Ammo')).toBe('20');
    // Every frame starts with the day sky.
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 1280, 720);
  });

  it('shoots on Space: a sound and one round less', () => {
    const frames = installFrames();
    render(<GameView choice={choice} sprites={sprites} audio={audio} onExit={vi.fn()} />);
    frames.run(1);

    fireEvent.keyDown(window, { code: 'Space' });
    frames.run(2);
    fireEvent.keyUp(window, { code: 'Space' });

    expect(play).toHaveBeenCalledWith('shot');
    expect(hudValue('Ammo')).toBe('19');
  });

  it('pauses on Escape and resumes from the dialog', () => {
    const frames = installFrames();
    render(<GameView choice={choice} sprites={sprites} audio={audio} onExit={vi.fn()} />);
    frames.run(2);

    fireEvent.keyDown(window, { code: 'Escape' });
    frames.run(1);
    fireEvent.keyUp(window, { code: 'Escape' });

    expect(frames.pending()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    frames.run(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(frames.pending()).toBe(1);
  });

  it('starts a new run with Play again once the run is over', () => {
    const frames = installFrames();
    render(<GameView choice={choice} sprites={sprites} audio={audio} onExit={vi.fn()} />);

    // Standing still, the hero is eventually hit five times; ten minutes of play at most.
    for (let i = 0; i < 12_000 && screen.queryByRole('dialog') === null; i += 1) {
      frames.run(1);
    }
    expect(screen.getByRole('dialog', { name: 'Game over' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    frames.run(2);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(hudValue('Lives')).toBe('5 of 5');
  });

  it('stops the run when it leaves the page', () => {
    const frames = installFrames();
    const view = render(
      <GameView choice={choice} sprites={sprites} audio={audio} onExit={vi.fn()} />,
    );
    frames.run(2);
    expect(frames.pending()).toBe(1);

    view.unmount();

    expect(frames.pending()).toBe(0);
  });

  it('explains when the browser has no 2D canvas context', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    render(<GameView choice={choice} sprites={sprites} audio={audio} onExit={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('does not support the canvas element');
  });
});
