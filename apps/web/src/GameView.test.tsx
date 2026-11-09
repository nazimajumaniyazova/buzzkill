import { type AudioMixer, createAudioMixer, type KeyBindings } from '@buzzkill/engine';
import { DEFAULT_KEY_BINDINGS, type GameAction, type GameSound } from '@buzzkill/game';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createGameSprites } from './game/sprites';
import { GameView } from './GameView';
import type { GameEvent } from './state/bridge';
import type { GameAssets, Run } from './state/machine';

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

const run: Run = { heroId: 'male', mode: 'day', seed: 1 };

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
  let assets: GameAssets;
  let play: ReturnType<typeof vi.fn<AudioMixer<GameSound>['play']>>;
  let onEvent: ReturnType<typeof vi.fn<(event: GameEvent) => void>>;

  /** The events reported so far, by type. */
  const reported = (): GameEvent['type'][] => onEvent.mock.calls.map(([event]) => event.type);

  interface ViewProps {
    readonly run: Run;
    readonly paused: boolean;
    readonly keyBindings: KeyBindings<GameAction>;
  }

  function renderView(props: Partial<ViewProps> = {}) {
    const view = render(
      <GameView
        run={props.run ?? run}
        assets={assets}
        paused={props.paused ?? false}
        keyBindings={props.keyBindings ?? DEFAULT_KEY_BINDINGS}
        onEvent={onEvent}
      />,
    );
    return {
      ...view,
      rerender(next: Partial<ViewProps>): void {
        view.rerender(
          <GameView
            run={next.run ?? props.run ?? run}
            assets={assets}
            paused={next.paused ?? false}
            keyBindings={next.keyBindings ?? props.keyBindings ?? DEFAULT_KEY_BINDINGS}
            onEvent={onEvent}
          />,
        );
      },
    };
  }

  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    play = vi.fn<AudioMixer<GameSound>['play']>();
    audio = { ...createAudioMixer({ context: null, buffers: {} }), play };
    assets = { sprites, audio };
    onEvent = vi.fn<(event: GameEvent) => void>();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('runs the game on the canvas and shows its HUD', () => {
    const frames = installFrames();
    renderView();

    // 6 ticks, before the first round comes back at tick 12.
    frames.run(3);

    expect(hudValue('Score')).toBe('0');
    expect(hudValue('Ammo')).toBe('20');
    // Every frame starts with the day sky.
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 1280, 720);
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("shoots on the player's own key, not on the default one it replaced", () => {
    const frames = installFrames();
    renderView({ keyBindings: { ...DEFAULT_KEY_BINDINGS, fire: ['KeyF', 'KeyJ'] } });
    frames.run(1);

    fireEvent.keyDown(window, { code: 'Space' });
    frames.run(2);
    fireEvent.keyUp(window, { code: 'Space' });
    expect(play).not.toHaveBeenCalledWith('shot');

    fireEvent.keyDown(window, { code: 'KeyF' });
    frames.run(2);
    fireEvent.keyUp(window, { code: 'KeyF' });
    expect(play).toHaveBeenCalledWith('shot');
  });

  it('applies new keys to the run on screen', () => {
    const frames = installFrames();
    const view = renderView();
    frames.run(1);

    view.rerender({ keyBindings: { ...DEFAULT_KEY_BINDINGS, fire: ['KeyF', 'KeyJ'] } });
    fireEvent.keyDown(window, { code: 'Space' });
    frames.run(2);
    fireEvent.keyUp(window, { code: 'Space' });
    expect(play).not.toHaveBeenCalledWith('shot');

    fireEvent.keyDown(window, { code: 'KeyF' });
    frames.run(2);
    fireEvent.keyUp(window, { code: 'KeyF' });
    expect(play).toHaveBeenCalledWith('shot');
  });

  it('shoots on Space: a sound and one round less', () => {
    const frames = installFrames();
    renderView();
    frames.run(1);

    fireEvent.keyDown(window, { code: 'Space' });
    frames.run(2);
    fireEvent.keyUp(window, { code: 'Space' });

    expect(play).toHaveBeenCalledWith('shot');
    expect(hudValue('Ammo')).toBe('19');
  });

  it("reports the game's own pause on Escape and goes on when the machine says so", () => {
    const frames = installFrames();
    const view = renderView();
    frames.run(2);

    fireEvent.keyDown(window, { code: 'Escape' });
    frames.run(1);
    fireEvent.keyUp(window, { code: 'Escape' });

    expect(reported()).toEqual(['gamePaused']);
    expect(frames.pending()).toBe(0);

    // The machine mirrors the pause, then resumes on the player's command.
    view.rerender({ paused: true });
    expect(reported()).toEqual(['gamePaused']);
    view.rerender({ paused: false });

    expect(reported()).toEqual(['gamePaused', 'gameResumed']);
    expect(frames.pending()).toBe(1);
  });

  it('holds the game when the machine says paused', () => {
    const frames = installFrames();
    const view = renderView();
    frames.run(2);

    view.rerender({ paused: true });

    expect(frames.pending()).toBe(0);
    expect(reported()).toEqual(['gamePaused']);
  });

  it('reports the end of the run once and starts a new run on a new run object', () => {
    const frames = installFrames();
    const view = renderView();

    // Standing still, the hero is eventually hit five times; ten minutes of play at most.
    for (let i = 0; i < 12_000 && !reported().includes('runEnded'); i += 1) {
      frames.run(1);
    }
    const ended = onEvent.mock.calls.map(([event]) => event).find((e) => e.type === 'runEnded');
    expect(ended?.type === 'runEnded' ? ended.result.status : null).toBe('lost');
    expect(hudValue('Lives')).toBe('0 of 5');

    // The world moves on for the picture, but the end is reported once.
    frames.run(20);
    expect(reported().filter((type) => type === 'runEnded')).toHaveLength(1);

    view.rerender({ run: { ...run, seed: 2 } });
    frames.run(2);

    expect(hudValue('Lives')).toBe('5 of 5');
  });

  it('stops the run when it leaves the page', () => {
    const frames = installFrames();
    const view = renderView();
    frames.run(2);
    expect(frames.pending()).toBe(1);

    view.unmount();

    expect(frames.pending()).toBe(0);
  });

  it('explains when the browser has no 2D canvas context', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    renderView();

    expect(screen.getByRole('alert')).toHaveTextContent('does not support the canvas element');
  });
});
