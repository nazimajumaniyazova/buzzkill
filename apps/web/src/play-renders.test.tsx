import { createAudioMixer } from '@buzzkill/engine';
import type * as GameModule from '@buzzkill/game';
import { createGame, type Game, type GameHud as Hud, type GameSound } from '@buzzkill/game';
import { act, fireEvent, render } from '@testing-library/react';
import { Profiler, type ProfilerOnRenderCallback } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { GAME_ASSETS } from './game/assets';
import { createGameSprites, type GameImages } from './game/sprites';
import type * as GameHudModule from './GameHud';
import { GameHud } from './GameHud';
import type * as GameViewModule from './GameView';
import { GameView } from './GameView';
import { createAppStore, type GameAssets, type Run } from './state/machine';

// The real modules, with spies that count the calls: a call of a component is one render.
vi.mock('@buzzkill/game', async (importOriginal) => {
  const actual = await importOriginal<typeof GameModule>();
  return { ...actual, createGame: vi.fn(actual.createGame) };
});
vi.mock('./GameView', async (importOriginal) => {
  const actual = await importOriginal<typeof GameViewModule>();
  return { ...actual, GameView: vi.fn(actual.GameView) };
});
vi.mock('./GameHud', async (importOriginal) => {
  const actual = await importOriginal<typeof GameHudModule>();
  return { ...actual, GameHud: vi.fn(actual.GameHud) };
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

const image = {} as ImageBitmap;
// The same stand-in for every image of the manifest: the canvas here is a fake.
// `Object.fromEntries` drops the key types; the keys are those of the manifest.
const images = Object.fromEntries(
  Object.keys(GAME_ASSETS).map((id) => [id, image]),
) as GameImages<ImageBitmap>;
const assets: GameAssets = {
  sprites: createGameSprites(images),
  audio: createAudioMixer<GameSound, AudioBuffer>({ context: null, buffers: {} }),
};

const run: Run = { heroId: 'male', mode: 'day', seed: 1, speed: 1, difficulty: 'normal' };

/** Ten seconds of play: 200 frames of 50 ms, three ticks each. */
const FRAMES = 200;

/** Animation frames that run one at a time, each in its own `act`, so each can commit once. */
function installFrames() {
  let timeMs = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextHandle = 1;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
    const handle = nextHandle;
    nextHandle += 1;
    callbacks.set(handle, callback);
    return handle;
  });
  vi.stubGlobal('cancelAnimationFrame', (handle: number): void => {
    callbacks.delete(handle);
  });
  return (): void => {
    act(() => {
      const due = [...callbacks.values()];
      callbacks.clear();
      timeMs += 50;
      for (const callback of due) {
        callback(timeMs);
      }
    });
  };
}

const shown = (hud: Hud): string => `${String(hud.score)} ${String(hud.lives)} ${String(hud.ammo)}`;

describe('renders during play', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('commits only for a changed HUD value; the shell, the canvas and the HUD frame never render', async () => {
    const frame = installFrames();
    const onRender = vi.fn<ProfilerOnRenderCallback>();
    render(
      <Profiler id="shell" onRender={onRender}>
        <App store={createAppStore({ name: 'playing', assets, run, time: run.mode })} />
      </Profiler>,
    );
    // The game view comes with the game chunk (#112). Waiting for it inside act lets React mount
    // the view, start the run and subscribe the HUD before the first frame.
    await act(() => vi.dynamicImportSettled());
    expect(createGame).toHaveBeenCalledOnce();
    const game = vi.mocked(createGame).mock.results[0]?.value as Game;

    // Everything from here on is play: count what the game publishes and what React does.
    const published: Hud[] = [];
    game.subscribe((hud) => {
      published.push(hud);
    });
    const commitsBefore = onRender.mock.calls.length;
    const viewRendersBefore = vi.mocked(GameView).mock.calls.length;
    const hudRendersBefore = vi.mocked(GameHud).mock.calls.length;
    let shownChanges = 0;
    let last = shown(game.getHud());

    for (let i = 0; i < FRAMES; i += 1) {
      // A shot every twenty frames: the ammo drops, comes back, and hits score.
      if (i % 20 === 5) {
        fireEvent.keyDown(window, { code: 'Space' });
      }
      if (i % 20 === 6) {
        fireEvent.keyUp(window, { code: 'Space' });
      }
      frame();
      const now = shown(game.getHud());
      if (now !== last) {
        shownChanges += 1;
        last = now;
      }
    }

    // The run is still on: no pause, no end, so the machine had nothing to do.
    expect(game.getHud()).toMatchObject({ status: 'playing', paused: false });
    // The game notifies only on a change, at most once per frame.
    expect(published.length).toBeLessThanOrEqual(FRAMES);
    expect(published.length).toBeGreaterThan(10);
    const repeats = published.filter(
      (hud, index) => index > 0 && shown(hud) === shown(published[index - 1] ?? hud),
    );
    expect(repeats).toEqual([]);
    // One commit per frame that changed a value on screen, and nothing else renders.
    expect(onRender.mock.calls.length - commitsBefore).toBe(shownChanges);
    expect(vi.mocked(GameView).mock.calls.length - viewRendersBefore).toBe(0);
    expect(vi.mocked(GameHud).mock.calls.length - hudRendersBefore).toBe(0);
  });
});
