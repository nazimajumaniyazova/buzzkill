import { type AudioMixer, createAudioMixer } from '@buzzkill/engine';
import type * as GameModule from '@buzzkill/game';
import { createGame, type Game, type GameSound, type Replay, simulate } from '@buzzkill/game';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { GAME_ASSETS } from './game/assets';
import { GAME_VERSION } from './game/run-options';
import { createGameSprites, type GameImages } from './game/sprites';
import { ReplayView } from './ReplayView';
import type { GameAssets } from './state/machine';

// The real game, with createGame watched so that a test can read the options and the run.
vi.mock('@buzzkill/game', async (importOriginal) => {
  const actual = await importOriginal<typeof GameModule>();
  return { ...actual, createGame: vi.fn(actual.createGame) };
});

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

// The same stand-in for every image of the manifest: the canvas here is a fake.
// `Object.fromEntries` drops the key types; the keys are those of the manifest.
const images = Object.fromEntries(
  Object.keys(GAME_ASSETS).map((id) => [id, {} as ImageBitmap]),
) as GameImages<ImageBitmap>;
const sprites = createGameSprites(images);

/** A run where the hero never moves or fires: it is lost in about 25 seconds of game time. */
const replay: Replay = {
  formatVersion: 3,
  gameVersion: GAME_VERSION,
  seed: 1,
  heroId: 'male',
  mode: 'day',
  difficulty: 'normal',
  daily: null,
  inputs: [],
};

/**
 * Animation frames that run only when the test says so, 50 ms apart: at 1× every frame after the
 * first runs three ticks.
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

/** The run the view created last. */
function lastGame(): Game {
  const result = vi.mocked(createGame).mock.results.at(-1);
  if (result?.type !== 'return') {
    throw new Error('no game was created');
  }
  return result.value;
}

describe('ReplayView', () => {
  let play: ReturnType<typeof vi.fn<AudioMixer<GameSound>['play']>>;
  let assets: GameAssets;
  let onTime: ReturnType<typeof vi.fn<(time: 'day' | 'night') => void>>;
  let onBack: ReturnType<typeof vi.fn<() => void>>;

  function renderView(watched: Replay = replay) {
    return render(
      <ReplayView
        replay={watched}
        assets={assets}
        effects={{
          reducedMotion: false,
          particles: true,
          screenShake: true,
          hitFlash: true,
          squashStretch: true,
          hitStop: true,
        }}
        onTime={onTime}
        onBack={onBack}
      />,
    );
  }

  /** Runs frames until the replay says it is over; returns how many it took. */
  function framesToEnd(frames: ReturnType<typeof installFrames>): number {
    for (let count = 1; count <= 5000; count += 1) {
      frames.run(1);
      if (screen.queryByText('The replay is over.') !== null) {
        return count;
      }
    }
    throw new Error('the replay did not end');
  }

  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    play = vi.fn<AudioMixer<GameSound>['play']>();
    assets = {
      sprites,
      audio: { ...createAudioMixer({ context: null, buffers: {} }), play },
      music: { follow: () => undefined },
    };
    onTime = vi.fn<(time: 'day' | 'night') => void>();
    onBack = vi.fn<() => void>();
  });

  afterEach(() => {
    vi.mocked(createGame).mockClear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('plays the stored run on the canvas with its HUD, to the end the server finds', () => {
    const frames = installFrames();
    renderView();

    framesToEnd(frames);

    expect(screen.getByRole('main', { name: 'Replay' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Game status' })).toBeInTheDocument();
    expect(lastGame().result()).toEqual(simulate(replay, { maxTicks: 60 * 60 * 10 }));
    // What it played is the stored run, tick for tick.
    expect(lastGame().replay()).toEqual(replay);
    // The same pictures and sounds as the run: the hero was hit until the end.
    expect(context.drawImage).toHaveBeenCalled();
    expect(play.mock.calls.map(([sound]) => sound)).toContain('hit');
  });

  it('counts no achievement and plays no haptics, and the keys steer nothing', () => {
    const frames = installFrames();
    renderView();
    frames.run(2);

    fireEvent.keyDown(window, { code: 'Space' });
    frames.run(10);
    fireEvent.keyUp(window, { code: 'Space' });

    const options = vi.mocked(createGame).mock.calls[0]?.[0];
    expect(options?.followers).toBeUndefined();
    expect(options?.haptics).toBeUndefined();
    expect(play.mock.calls.map(([sound]) => sound)).not.toContain('shot');
  });

  it('pauses and plays on from the same tick', () => {
    const frames = installFrames();
    renderView();
    frames.run(3);

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    expect(frames.pending()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(frames.pending()).toBe(1);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  // It plays the whole replay three times, which takes a few seconds when the full suite runs in
  // parallel, past the default 5 s.
  it('plays at the speed chosen', { timeout: 15_000 }, () => {
    const atSpeed = (label: string | null): number => {
      const frames = installFrames();
      const view = renderView();
      if (label !== null) {
        fireEvent.click(screen.getByRole('radio', { name: label }));
      }
      const count = framesToEnd(frames);
      view.unmount();
      return count;
    };

    const normal = atSpeed(null);
    const half = atSpeed('0.5×');
    const double = atSpeed('2×');

    expect(screen.queryByRole('radio')).toBeNull();
    expect(Math.abs(half - 2 * normal)).toBeLessThanOrEqual(2);
    expect(double).toBeLessThan(normal);
  });

  it('offers the four speeds, at 1× to begin with', () => {
    installFrames();
    renderView();

    expect(screen.getByRole('group', { name: 'Speed' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.getByRole('radio', { name: '1×' })).toBeChecked();
  });

  it('starts the replay again from the beginning', () => {
    const frames = installFrames();
    renderView();
    framesToEnd(frames);
    const first = lastGame();
    const dispose = vi.spyOn(first, 'dispose');

    fireEvent.click(screen.getByRole('button', { name: 'Watch from the start' }));

    expect(dispose).toHaveBeenCalledOnce();
    expect(lastGame()).not.toBe(first);
    expect(screen.queryByText('The replay is over.')).toBeNull();
    frames.run(2);
    expect(lastGame().result().ticks).toBeLessThan(10);
  });

  it('says the time of day of the level on screen, from the first one', () => {
    installFrames();
    renderView({ ...replay, mode: 'night' });

    expect(onTime).toHaveBeenLastCalledWith('night');
  });

  it('goes back', () => {
    installFrames();
    renderView();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledOnce();
  });

  it('says so and still goes back in a browser without canvas', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    renderView();

    expect(screen.getByRole('alert')).toHaveTextContent('does not support the canvas');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(createGame).not.toHaveBeenCalled();
  });

  it('has no accessibility violations', async () => {
    installFrames();
    const { container } = renderView();

    expect(await axe(container)).toHaveNoViolations();
  });
});
