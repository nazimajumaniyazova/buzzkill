import {
  type AudioMixer,
  createAudioMixer,
  createEventBus,
  type KeyBindings,
} from '@buzzkill/engine';
import type * as GameModule from '@buzzkill/game';
import {
  type AchievementId,
  type AchievementProgress,
  createGame,
  DEFAULT_KEY_BINDINGS,
  type Game,
  type GameAction,
  type GameEvents,
  type GameSound,
  noProgress,
} from '@buzzkill/game';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Analytics } from './analytics/analytics';
import { AnnouncerProvider, createAnnouncer } from './announcer';
import { ErrorBoundary } from './ErrorBoundary';
import { reportError } from './errors/report-error';
import { GAME_ASSETS } from './game/assets';
import type * as DrawGameModule from './game/draw-game';
import { createGameDrawer } from './game/draw-game';
import { PITCH_CENTS } from './game/game-audio';
import { HAPTIC_MS } from './game/haptics';
import { createGameSprites, type GameImages } from './game/sprites';
import { GameView } from './GameView';
import type { GameEvent } from './state/bridge';
import type { GameAssets, Run } from './state/machine';

// The real game, with createGame watched so that a test can make a start fail.
vi.mock('@buzzkill/game', async (importOriginal) => {
  const actual = await importOriginal<typeof GameModule>();
  return { ...actual, createGame: vi.fn(actual.createGame) };
});

vi.mock('./errors/report-error', () => ({ reportError: vi.fn() }));

// The real drawing code, watched so that a test can read the options a run gave it.
vi.mock('./game/draw-game', async (importOriginal) => {
  const actual = await importOriginal<typeof DrawGameModule>();
  return { ...actual, createGameDrawer: vi.fn(actual.createGameDrawer) };
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
const sprites = createGameSprites(images);

const run: Run = {
  heroId: 'male',
  mode: 'day',
  seed: 1,
  speed: 1,
  difficulty: 'normal',
  daily: null,
};

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
  /** The sounds played so far, in order. */
  const sounds = (): GameSound[] => play.mock.calls.map(([sound]) => sound);
  let assets: GameAssets;
  let play: ReturnType<typeof vi.fn<AudioMixer<GameSound>['play']>>;
  let onEvent: ReturnType<typeof vi.fn<(event: GameEvent) => void>>;
  let onAchievements: ReturnType<
    typeof vi.fn<(progress: AchievementProgress, earned: readonly AchievementId[]) => void>
  >;
  let track: ReturnType<typeof vi.fn<Analytics['track']>>;

  /** The events reported so far, by type. */
  const reported = (): GameEvent['type'][] => onEvent.mock.calls.map(([event]) => event.type);

  interface ViewProps {
    readonly run: Run;
    readonly paused: boolean;
    readonly keyBindings: KeyBindings<GameAction>;
    readonly reducedMotion: boolean;
    readonly particles: boolean;
    readonly screenShake: boolean;
    readonly hitFlash: boolean;
    readonly squashStretch: boolean;
    readonly hitStop: boolean;
    readonly vibration: boolean;
    readonly achievements: AchievementProgress;
    readonly betweenLevels: boolean;
  }

  function renderView(props: Partial<ViewProps> = {}) {
    const view = render(
      <GameView
        run={props.run ?? run}
        assets={assets}
        paused={props.paused ?? false}
        keyBindings={props.keyBindings ?? DEFAULT_KEY_BINDINGS}
        reducedMotion={props.reducedMotion ?? false}
        particles={props.particles ?? true}
        screenShake={props.screenShake ?? true}
        hitFlash={props.hitFlash ?? true}
        squashStretch={props.squashStretch ?? true}
        hitStop={props.hitStop ?? true}
        vibration={props.vibration ?? true}
        achievements={props.achievements ?? noProgress()}
        onAchievements={onAchievements}
        track={track}
        betweenLevels={props.betweenLevels ?? false}
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
            reducedMotion={next.reducedMotion ?? props.reducedMotion ?? false}
            particles={next.particles ?? props.particles ?? true}
            screenShake={next.screenShake ?? props.screenShake ?? true}
            hitFlash={next.hitFlash ?? props.hitFlash ?? true}
            squashStretch={next.squashStretch ?? props.squashStretch ?? true}
            hitStop={next.hitStop ?? props.hitStop ?? true}
            vibration={next.vibration ?? props.vibration ?? true}
            achievements={next.achievements ?? props.achievements ?? noProgress()}
            onAchievements={onAchievements}
            track={track}
            betweenLevels={next.betweenLevels ?? props.betweenLevels ?? false}
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
    // The shell drives the music; the game view never touches it.
    assets = { sprites, audio, music: { follow: () => undefined } };
    onEvent = vi.fn<(event: GameEvent) => void>();
    onAchievements =
      vi.fn<(progress: AchievementProgress, earned: readonly AchievementId[]) => void>();
    track = vi.fn<Analytics['track']>();
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
    // Every frame starts with the sky of the day city, still, over the whole world.
    expect(context.drawImage).toHaveBeenCalledWith(image, 0, 0, 1280, 720, 0, 0, 1280, 720);
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("shoots on the player's own key, not on the default one it replaced", () => {
    const frames = installFrames();
    renderView({ keyBindings: { ...DEFAULT_KEY_BINDINGS, fire: ['KeyF', 'KeyJ'] } });
    frames.run(1);

    fireEvent.keyDown(window, { code: 'Space' });
    frames.run(2);
    fireEvent.keyUp(window, { code: 'Space' });
    expect(sounds()).not.toContain('shot');

    fireEvent.keyDown(window, { code: 'KeyF' });
    frames.run(2);
    fireEvent.keyUp(window, { code: 'KeyF' });
    expect(sounds()).toContain('shot');
  });

  it('applies new keys to the run on screen', () => {
    const frames = installFrames();
    const view = renderView();
    frames.run(1);

    view.rerender({ keyBindings: { ...DEFAULT_KEY_BINDINGS, fire: ['KeyF', 'KeyJ'] } });
    fireEvent.keyDown(window, { code: 'Space' });
    frames.run(2);
    fireEvent.keyUp(window, { code: 'Space' });
    expect(sounds()).not.toContain('shot');

    fireEvent.keyDown(window, { code: 'KeyF' });
    frames.run(2);
    fireEvent.keyUp(window, { code: 'KeyF' });
    expect(sounds()).toContain('shot');
  });

  it('applies a change of the motion setting to the run on screen without restarting it', () => {
    const frames = installFrames();
    const view = renderView();
    frames.run(1);
    const drawers = vi.mocked(createGameDrawer).mock.calls.length;
    const options = vi.mocked(createGameDrawer).mock.lastCall?.[2];
    expect(options?.reducedMotion?.()).toBe(false);

    view.rerender({ reducedMotion: true });
    frames.run(1);

    // The drawer reads the setting every frame, so the city slows down in the same run.
    expect(options?.reducedMotion?.()).toBe(true);
    expect(vi.mocked(createGameDrawer).mock.calls).toHaveLength(drawers);
  });

  it('applies a change of the particles setting to the run on screen, and seeds them with the run', () => {
    const frames = installFrames();
    const view = renderView();
    frames.run(1);
    const drawers = vi.mocked(createGameDrawer).mock.calls.length;
    const options = vi.mocked(createGameDrawer).mock.lastCall?.[2];
    expect(options?.particles?.()).toBe(true);
    expect(options?.seed).toBe(run.seed);

    view.rerender({ particles: false });
    frames.run(1);

    expect(options?.particles?.()).toBe(false);
    expect(vi.mocked(createGameDrawer).mock.calls).toHaveLength(drawers);
  });

  it('applies a change of the screen shake setting to the run on screen', () => {
    const frames = installFrames();
    const view = renderView();
    frames.run(1);
    const drawers = vi.mocked(createGameDrawer).mock.calls.length;
    const options = vi.mocked(createGameDrawer).mock.lastCall?.[2];
    expect(options?.screenShake?.()).toBe(true);

    view.rerender({ screenShake: false });
    frames.run(1);

    expect(options?.screenShake?.()).toBe(false);
    expect(vi.mocked(createGameDrawer).mock.calls).toHaveLength(drawers);
  });

  it('applies a change of the flash and the squash settings to the run on screen', () => {
    const frames = installFrames();
    const view = renderView();
    frames.run(1);
    const options = vi.mocked(createGameDrawer).mock.lastCall?.[2];
    expect([options?.hitFlash?.(), options?.squashStretch?.()]).toEqual([true, true]);

    view.rerender({ hitFlash: false, squashStretch: false });
    frames.run(1);

    expect([options?.hitFlash?.(), options?.squashStretch?.()]).toEqual([false, false]);
  });

  it('applies a change of the hit-stop setting to the run on screen', () => {
    const frames = installFrames();
    const view = renderView();
    frames.run(1);
    const options = vi.mocked(createGameDrawer).mock.lastCall?.[2];
    expect(options?.hitStop?.()).toBe(true);

    view.rerender({ hitStop: false });
    frames.run(1);

    expect(options?.hitStop?.()).toBe(false);
  });

  it('vibrates on a hit where the device can, following the setting on screen', () => {
    const vibrate = vi.fn(function (this: unknown) {
      return this === navigator;
    });
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    try {
      const frames = installFrames();
      const view = renderView();
      frames.run(1);
      const haptics = vi.mocked(createGame).mock.lastCall?.[0].haptics;

      haptics?.play('hit');
      expect(vibrate).toHaveBeenCalledExactlyOnceWith(HAPTIC_MS.hit);
      expect(vibrate).toHaveReturnedWith(true);

      view.rerender({ vibration: false });
      frames.run(1);
      haptics?.play('hit');
      expect(vibrate).toHaveBeenCalledOnce();
    } finally {
      Reflect.deleteProperty(navigator, 'vibrate');
    }
  });

  it('gives the run no haptics where the device cannot vibrate', () => {
    const frames = installFrames();
    renderView();
    frames.run(1);

    expect('vibrate' in navigator).toBe(false);
    expect(vi.mocked(createGame).mock.lastCall?.[0]).not.toHaveProperty('haptics');
  });

  it('counts the run toward the achievements from the progress so far, and reports it (#163)', () => {
    const frames = installFrames();
    renderView({ achievements: { ...noProgress(), swatter: 7 } });
    frames.run(1);
    const followers = vi.mocked(createGame).mock.lastCall?.[0].followers ?? [];
    const events = createEventBus<GameEvents>();

    for (const follow of followers) {
      follow(events);
    }
    events.emit('enemyDestroyed', { x: 0, y: 0, value: 1 });

    expect(onAchievements).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ firstSwat: 1, swatter: 8 }),
      ['firstSwat'],
    );
  });

  it('counts the levels, the queen and a death for the analytics, marked slower (#223)', () => {
    const frames = installFrames();
    renderView({ run: { ...run, speed: 0.75 } });
    frames.run(1);
    const followers = vi.mocked(createGame).mock.lastCall?.[0].followers ?? [];
    const events = createEventBus<GameEvents>();

    for (const follow of followers) {
      follow(events);
    }
    events.emit('levelStarted', { level: 2, mode: 'day' });
    events.emit('playerHit', { livesLeft: 0, cause: 'day-2' });
    events.emit('gameOver', { result: 'lost', score: 10 });

    expect(track.mock.calls).toEqual([
      ['level_reached', { level: 2, slower: true }],
      ['death', { level: 2, cause: 'day-2', slower: true }],
    ]);
  });

  it('plays the shot a little off its pitch, from the left, where the hero stands (#161)', () => {
    const frames = installFrames();
    renderView();
    frames.run(1);

    fireEvent.keyDown(window, { code: 'Space' });
    frames.run(2);

    const options = play.mock.calls.find(([sound]) => sound === 'shot')?.[1];
    const cents = Math.log2(options?.rate ?? Number.NaN) * 1200;
    expect(Math.abs(cents)).toBeLessThanOrEqual(PITCH_CENTS);
    expect(options?.pan).toBeLessThan(0);
  });

  describe('with a gamepad', () => {
    /** A pad in the standard mapping, which the test changes in place. */
    const pad = {
      index: 0,
      connected: true,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
      axes: [0, 0, 0, 0],
    };
    let pads: (typeof pad | null)[] = [];

    beforeEach(() => {
      pad.axes[1] = 0;
      pads = [pad];
      Object.defineProperty(navigator, 'getGamepads', { value: () => pads, configurable: true });
    });

    afterEach(() => {
      Reflect.deleteProperty(navigator, 'getGamepads');
      vi.unstubAllGlobals();
    });

    it('moves the hero with the left stick, past a dead zone', () => {
      const frames = installFrames();
      renderView();
      frames.run(1);
      const input = vi.mocked(createGame).mock.lastCall?.[0].input;

      pad.axes[1] = -0.3;
      input?.sample();
      expect(input?.isHeld('moveUp')).toBe(false);

      pad.axes[1] = -0.8;
      input?.sample();
      expect(input?.isHeld('moveUp')).toBe(true);

      pad.axes[1] = 0.8;
      input?.sample();
      expect([input?.isHeld('moveUp'), input?.isHeld('moveDown')]).toEqual([false, true]);
    });

    it('rumbles the gamepad on a hit where the browser can, following the setting', () => {
      const playEffect = vi.fn(() => Promise.resolve('complete'));
      pads = [{ ...pad, vibrationActuator: { playEffect } } as typeof pad];
      vi.stubGlobal('GamepadHapticActuator', vi.fn());
      const frames = installFrames();
      const view = renderView();
      frames.run(1);
      const haptics = vi.mocked(createGame).mock.lastCall?.[0].haptics;

      haptics?.play('hit');
      expect(playEffect).toHaveBeenCalledExactlyOnceWith(
        'dual-rumble',
        expect.objectContaining({ duration: HAPTIC_MS.hit }),
      );

      view.rerender({ vibration: false });
      frames.run(1);
      haptics?.play('hit');
      expect(playEffect).toHaveBeenCalledOnce();
    });

    it('reports a gamepad that disconnects during the run, once', () => {
      const frames = installFrames();
      renderView();
      frames.run(2);
      expect(reported()).not.toContain('gamepadLost');

      pads = [];
      frames.run(3);

      expect(reported().filter((type) => type === 'gamepadLost')).toHaveLength(1);
    });
  });

  it('starts the next level when the machine leaves the screen between levels', () => {
    const frames = installFrames();
    const view = renderView({ betweenLevels: true });
    frames.run(1);
    const game = vi.mocked(createGame).mock.results.at(-1)?.value as Game;
    const nextLevel = vi.spyOn(game, 'nextLevel');

    view.rerender({ betweenLevels: true });
    expect(nextLevel).not.toHaveBeenCalled();

    view.rerender({ betweenLevels: false });
    expect(nextLevel).toHaveBeenCalledOnce();
  });

  it('starts the game at the difficulty of the run', () => {
    installFrames();
    renderView({ run: { ...run, difficulty: 'hard' } });

    expect(vi.mocked(createGame).mock.lastCall?.[0].settings).toEqual({
      heroId: 'male',
      mode: 'day',
      difficulty: 'hard',
      daily: null,
    });
  });

  it('starts a daily run with its date, which the replay records (#165)', () => {
    installFrames();
    renderView({ run: { ...run, daily: '2026-11-17' } });

    expect(vi.mocked(createGame).mock.lastCall?.[0].settings).toMatchObject({
      daily: '2026-11-17',
    });
  });

  it('shoots on Space: a sound and one round less', () => {
    const frames = installFrames();
    renderView();
    frames.run(1);

    fireEvent.keyDown(window, { code: 'Space' });
    frames.run(2);
    fireEvent.keyUp(window, { code: 'Space' });

    expect(sounds()).toContain('shot');
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

  /** The game view under the error boundary of the run, as App puts it. */
  function renderGuarded() {
    const onError = vi.fn();
    render(
      <ErrorBoundary area="game" fallback={<p>The run stopped</p>} onError={onError}>
        <GameView
          run={run}
          assets={assets}
          paused={false}
          keyBindings={DEFAULT_KEY_BINDINGS}
          reducedMotion={false}
          particles
          screenShake
          hitFlash
          squashStretch
          hitStop
          vibration
          achievements={noProgress()}
          onAchievements={vi.fn()}
          betweenLevels={false}
          onEvent={onEvent}
        />
      </ErrorBoundary>,
      // As in main.tsx: the boundary reports what it catches.
      { onCaughtError: () => undefined },
    );
    return { onError };
  }

  it('hands an error thrown in a frame to the error boundary, which ends the run', () => {
    const frames = installFrames();
    const { onError } = renderGuarded();
    frames.run(2);
    expect(frames.pending()).toBe(1);

    context.clearRect.mockImplementationOnce(() => {
      throw new Error('Drawing failed');
    });
    frames.run(1);

    expect(screen.getByText('The run stopped')).toBeInTheDocument();
    expect(reportError).toHaveBeenCalledExactlyOnceWith(new Error('Drawing failed'), {
      source: 'game',
      componentStack: expect.stringContaining('GameView') as unknown,
    });
    expect(onError).toHaveBeenCalledOnce();
    // The view unmounted and disposed the run: no frame is waiting.
    expect(frames.pending()).toBe(0);
    vi.mocked(reportError).mockClear();
  });

  it('releases what a run took when it fails to start, and hands the error to the boundary', () => {
    installFrames();
    vi.mocked(createGame).mockImplementationOnce(() => {
      throw new Error('The run did not start');
    });
    const added = vi.spyOn(window, 'addEventListener');
    const removed = vi.spyOn(window, 'removeEventListener');

    renderGuarded();

    expect(screen.getByText('The run stopped')).toBeInTheDocument();
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      new Error('The run did not start'),
      expect.objectContaining({ source: 'game' }),
    );
    // Every listener the run added before the error is gone: resize, the keyboard, the gamepad.
    const types = (spy: typeof added): string[] => spy.mock.calls.map(([type]) => type).sort();
    expect(types(added)).toContain('resize');
    expect(types(added)).toContain('keydown');
    expect(types(removed)).toEqual(types(added));
    vi.mocked(reportError).mockClear();
  });

  /** The run the last render created. */
  const lastGame = (): Game => vi.mocked(createGame).mock.results.at(-1)?.value as Game;

  it('runs the ticks of normal speed at every pace, half as many a second at 50%', () => {
    const frames = installFrames();
    const view = renderView();
    // The first frame sets the time; ten more of 50 ms are half a second.
    frames.run(11);
    const atFull = lastGame().result();
    view.unmount();

    renderView({ run: { ...run, speed: 0.5 } });
    frames.run(11);
    // Half, give or take the tick that the rounding of the clock moves.
    expect(Math.abs(lastGame().result().ticks * 2 - atFull.ticks)).toBeLessThanOrEqual(1);
    // More frames reach the same tick, and there the same state, as normal speed did.
    for (let i = 0; i < 20 && lastGame().result().ticks < atFull.ticks; i += 1) {
      frames.run(1);
    }
    expect(lastGame().result()).toEqual(atFull);
  });

  it('tells screen readers that the run starts', () => {
    installFrames();
    render(
      <AnnouncerProvider announcer={createAnnouncer()}>
        <GameView
          run={run}
          assets={assets}
          paused={false}
          keyBindings={DEFAULT_KEY_BINDINGS}
          reducedMotion={false}
          particles
          screenShake
          hitFlash
          squashStretch
          hitStop
          vibration
          achievements={noProgress()}
          onAchievements={vi.fn()}
          betweenLevels={false}
          onEvent={onEvent}
        />
      </AnnouncerProvider>,
    );

    const [polite] = screen.getAllByRole('log');
    expect(polite).toHaveTextContent('Level 1. Go!');
  });

  it('shoots on the fire button of a touch screen: a sound and one round less', () => {
    const frames = installFrames();
    renderView();
    frames.run(1);
    const fire = screen.getByTestId('touch-fire');

    fireEvent.pointerDown(fire, { pointerId: 1 });
    frames.run(2);
    fireEvent.pointerUp(fire, { pointerId: 1 });

    expect(sounds()).toContain('shot');
    expect(hudValue('Ammo')).toBe('19');
  });

  it('pauses by the pause button of a touch screen, reported like its own pause', () => {
    const frames = installFrames();
    renderView();
    frames.run(2);

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    expect(reported()).toEqual(['gamePaused']);
    expect(frames.pending()).toBe(0);
  });

  it('suggests turning the screen sideways while it is upright and narrow, until it turns', () => {
    vi.stubGlobal('innerWidth', 412);
    vi.stubGlobal('innerHeight', 915);
    installFrames();
    renderView();
    expect(screen.getByText('Turn your phone sideways for a bigger picture.')).toBeVisible();

    act(() => {
      vi.stubGlobal('innerWidth', 915);
      vi.stubGlobal('innerHeight', 412);
      window.dispatchEvent(new Event('resize'));
    });

    expect(screen.queryByText(/sideways/)).not.toBeInTheDocument();
  });

  it('explains when the browser has no 2D canvas context', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    renderView();

    expect(screen.getByRole('alert')).toHaveTextContent('does not support the canvas element');
  });
});
