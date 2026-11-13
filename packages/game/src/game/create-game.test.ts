import { type ActionInput, createActionInput, type GameLoopHost } from '@buzzkill/engine';
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it, vi } from 'vitest';

import { GAME_ACTIONS, type GameAction } from '../actions';
import { LEVELS } from '../config/levels';
import { RULES } from '../config/rules';
import { deserializeReplay, type Replay, serializeReplay } from '../replay/format';
import type { RunResult } from '../replay/result';
import { simulate } from '../replay/simulate';
import { createSimulation } from '../simulation/simulation';
import type { GameState } from '../simulation/state';
import {
  createGame,
  type Game,
  type GameAudio,
  type GameHud,
  type GameRenderer,
  type GameView,
} from './create-game';

const FRAME_MS = 1000 / 60;

/** A host whose frames run only when the test calls `frame()`. */
function createFakeHost() {
  let pending: ((timeMs: number) => void) | null = null;
  let frames = 0;
  const host: GameLoopHost = {
    requestFrame(callback) {
      pending = callback;
      return 1;
    },
    cancelFrame() {
      pending = null;
    },
  };
  return {
    host,
    get hasPendingFrame() {
      return pending !== null;
    },
    /** Runs the pending frame; the frame after it comes `count` display frames later. */
    frame(count = 1) {
      const callback = pending;
      pending = null;
      callback?.(frames * FRAME_MS);
      frames += count;
    },
  };
}

interface Setup {
  game: Game;
  input: ActionInput<GameAction>;
  fake: ReturnType<typeof createFakeHost>;
  play: ReturnType<typeof vi.fn<GameAudio['play']>>;
  render: ReturnType<typeof vi.fn<GameRenderer['render']>>;
  /** The view of the last rendered frame. */
  view(): GameView;
}

function setup(seed = 1): Setup {
  const fake = createFakeHost();
  const input = createActionInput(GAME_ACTIONS);
  const play = vi.fn<GameAudio['play']>();
  const render = vi.fn<GameRenderer['render']>();
  const game = createGame({
    settings: { heroId: 'male', mode: 'day', difficulty: 'normal' },
    seed,
    gameVersion: 'test',
    input,
    host: fake.host,
    renderer: { render },
    audio: { play },
  });
  return {
    game,
    input,
    fake,
    play,
    render,
    view() {
      const call = render.mock.lastCall;
      if (call === undefined) {
        throw new Error('nothing was rendered yet');
      }
      return call[0];
    },
  };
}

/**
 * Ends the waves of the first level now. The view a renderer gets is the live state, so the test
 * can reach the end of a level without playing it through.
 */
function sendEveryWave(s: Setup): void {
  // The rendered view is the simulation's state object; writing to it is what a test needs here.
  const state = s.view() as unknown as GameState;
  state.wave = LEVELS[0].waves.length;
}

/** Runs frames until the simulation reaches `tick`. */
function runUntilTick(s: Setup, tick: number): void {
  s.fake.frame();
  while (s.view().tick < tick) {
    s.fake.frame();
  }
}

describe('createGame', () => {
  it('renders every frame and advances the simulation at 60 ticks per second', () => {
    const s = setup();
    s.game.start();

    for (let i = 0; i < 61; i += 1) {
      s.fake.frame();
    }

    expect(s.render).toHaveBeenCalledTimes(61);
    // The first frame only sets the time reference; 60 frames later about 60 ticks have run.
    expect(s.view().tick).toBeGreaterThanOrEqual(59);
    expect(s.view().tick).toBeLessThanOrEqual(61);
    const alpha = s.render.mock.lastCall?.[1];
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeLessThan(1);
  });

  it('starts with the HUD of a new run and keeps the same object while nothing changes', () => {
    const s = setup();
    const first = s.game.getHud();

    expect(first).toEqual({
      score: 0,
      lives: RULES.lives,
      ammo: RULES.ammo.start,
      level: 1,
      mode: 'day',
      status: 'playing',
      paused: false,
    });
    s.game.start();
    s.fake.frame();
    expect(s.game.getHud()).toBe(first);
  });

  it('publishes the HUD only when a value changes, at most once per frame', () => {
    const s = setup();
    const published: GameHud[] = [];
    s.game.subscribe((hud) => published.push(hud));
    s.game.start();

    let previous = s.game.getHud();
    for (let i = 0; i < 300; i += 1) {
      const before = published.length;
      s.fake.frame();
      const now = s.game.getHud();
      expect(published.length - before).toBe(now === previous ? 0 : 1);
      previous = now;
    }

    // Ammo refills one round every 12 ticks, so about 300 / 12 changes and not 300.
    expect(published.length).toBeGreaterThan(20);
    expect(published.length).toBeLessThan(30);
    for (let i = 1; i < published.length; i += 1) {
      expect(published[i]).not.toEqual(published[i - 1]);
    }
  });

  it('plays the shot sound and publishes the spent round when fire is pressed', () => {
    const s = setup();
    s.game.start();
    s.fake.frame();

    s.input.press('fire', 'key:Space');
    runUntilTick(s, s.view().tick + 1);

    expect(s.play).toHaveBeenCalledExactlyOnceWith('shot');
    expect(s.game.getHud().ammo).toBe(RULES.ammo.start - 1);
  });

  it('plays the hit and explosion sounds when an enemy reaches the hero', () => {
    const s = setup();
    s.game.start();

    // The hero stays at its start; with seed 1 an enemy flies into it within a minute.
    runUntilTick(s, 3600);

    expect(s.game.getHud().lives).toBeLessThan(RULES.lives);
    expect(s.play).toHaveBeenCalledWith('hit');
    expect(s.play).toHaveBeenCalledWith('explosion');
    expect(s.play).not.toHaveBeenCalledWith('shot');
  });

  it('pauses on the pause action without simulating that tick, and resumes on request', () => {
    const s = setup();
    const published: GameHud[] = [];
    s.game.subscribe((hud) => published.push(hud));
    s.game.start();
    runUntilTick(s, 5);
    const pausedAt = s.view().tick;

    s.input.press('pause', 'key:Escape');
    // A 60 Hz frame can run no tick at all; the press counts on the next tick that runs.
    while (s.fake.hasPendingFrame && !s.game.getHud().paused) {
      s.fake.frame();
    }

    expect(s.game.getHud().paused).toBe(true);
    expect(published.at(-1)?.paused).toBe(true);
    expect(s.fake.hasPendingFrame).toBe(false);
    expect(s.view().tick).toBe(pausedAt);

    s.input.release('pause', 'key:Escape');
    s.game.resume();
    expect(s.game.getHud().paused).toBe(false);
    runUntilTick(s, pausedAt + 3);
    expect(s.view().tick).toBeGreaterThanOrEqual(pausedAt + 3);
  });

  it('simulates none of the ticks left in a long frame after the pause press', () => {
    const s = setup();
    s.game.start();
    runUntilTick(s, 5);

    // The frame after this one comes four display frames late, so it runs about four ticks.
    s.fake.frame(4);
    const before = s.view().tick;
    s.input.press('pause', 'key:Escape');
    s.fake.frame();

    expect(s.game.getHud().paused).toBe(true);
    expect(s.view().tick).toBe(before);
  });

  it('pauses and resumes through the API, ignoring calls that change nothing', () => {
    const s = setup();
    const listener = vi.fn();
    s.game.subscribe(listener);

    s.game.pause();
    expect(s.game.getHud().paused).toBe(false);

    s.game.start();
    s.fake.frame();
    s.game.pause();
    s.game.pause();
    expect(listener).toHaveBeenCalledOnce();
    expect(s.fake.hasPendingFrame).toBe(false);

    s.game.resume();
    s.game.resume();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(s.fake.hasPendingFrame).toBe(true);
  });

  it('stops everything on dispose', () => {
    const s = setup();
    const listener = vi.fn();
    const unsubscribe = s.game.subscribe(listener);
    s.game.start();
    s.fake.frame();

    s.game.dispose();
    s.game.dispose();
    s.game.start();
    s.game.resume();
    s.input.press('fire', 'key:Space');
    s.fake.frame();

    expect(s.fake.hasPendingFrame).toBe(false);
    expect(s.play).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    // Both the old and a late subscription are inert and safe to remove.
    s.game.subscribe(listener)();
    unsubscribe();
    expect(listener).not.toHaveBeenCalled();
  });

  it('holds a cleared level without simulating, until nextLevel() starts the next one', () => {
    const s = setup();
    s.game.start();
    s.fake.frame();
    sendEveryWave(s);

    s.fake.frame(5);
    const held = s.game.getHud();
    const tick = s.view().tick;
    expect([held.status, held.level, held.paused]).toEqual(['levelCleared', 1, false]);
    // The loop stopped asking for frames: the screen between levels is never simulated.
    expect(s.fake.hasPendingFrame).toBe(false);

    s.game.pause();
    s.game.resume();
    expect(s.game.getHud()).toBe(held);

    s.game.nextLevel();
    s.fake.frame();
    s.fake.frame();
    expect(s.game.getHud()).toMatchObject({ status: 'playing', level: 2, paused: false });
    expect(s.view().tick).toBeGreaterThan(tick);
  });

  it('ignores nextLevel() while no level is cleared', () => {
    const s = setup();
    s.game.start();
    s.fake.frame();

    s.game.nextLevel();
    runUntilTick(s, 30);

    expect(s.game.getHud()).toMatchObject({ status: 'playing', level: 1 });
  });

  it('removes a listener with the function subscribe returned', () => {
    const s = setup();
    const listener = vi.fn();
    const unsubscribe = s.game.subscribe(listener);
    unsubscribe();
    s.game.start();
    s.fake.frame();

    s.game.pause();

    expect(listener).not.toHaveBeenCalled();
  });

  it('runs exactly the headless simulation: same seed and input, same state', () => {
    const s = setup(42);
    s.input.press('moveDown', 'key:ArrowDown');
    s.game.start();
    runUntilTick(s, 900);
    const view = s.view();

    const simulation = createSimulation({ seed: 42, heroId: 'male', mode: 'day' });
    simulation.step({ down: 2, pressed: 2 });
    while (simulation.state.tick < view.tick) {
      simulation.step({ down: 2, pressed: 0 });
    }
    const expected = simulation.state;

    expect(s.game.getHud()).toMatchObject({
      score: expected.score,
      lives: expected.lives,
      ammo: expected.ammo,
    });
    expect(view.world.count).toBe(expected.world.count);
    expect(view.world.y[view.player]).toBe(expected.world.y[expected.player]);
    for (let index = 0; index < expected.world.count; index += 1) {
      const id = expected.world.at(index);
      expect(view.world.x[id]).toBe(expected.world.x[id]);
    }
  });

  it('rejects an input whose actions are not GAME_ACTIONS in order', () => {
    const fake = createFakeHost();
    const input = createActionInput(['fire', 'moveUp', 'moveDown', 'pause'] as const);

    expect(() =>
      createGame({
        settings: { heroId: 'female', mode: 'night', difficulty: 'normal' },
        seed: 1,
        gameVersion: 'test',
        input,
        host: fake.host,
        renderer: { render: vi.fn() },
        audio: { play: vi.fn() },
      }),
    ).toThrow(/GAME_ACTIONS in order/);
  });
});

/** What `simulate` makes of the game's replay after a JSON round trip, as the server would. */
function replayAsServer(game: Game): RunResult {
  const parsed = deserializeReplay(serializeReplay(game.replay()));
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return simulate(parsed.replay, { maxTicks: game.result().ticks });
}

describe('createGame replays', () => {
  it('records a replay that simulate plays to the same result, pauses and taps included', () => {
    const s = setup(5);
    s.game.start();
    s.fake.frame();

    s.input.press('moveDown', 'key:ArrowDown');
    runUntilTick(s, 40);
    // A tap: pressed and released between two ticks still counts as one shot.
    s.input.press('fire', 'key:Space');
    s.input.release('fire', 'key:Space');
    runUntilTick(s, 60);
    // Fire and pause in the same tick: the pause wins and that tick is not simulated.
    s.input.press('fire', 'key:Space');
    s.input.press('pause', 'key:Escape');
    while (!s.game.getHud().paused) {
      s.fake.frame();
    }
    s.input.release('pause', 'key:Escape');
    s.input.release('moveDown', 'key:ArrowDown');
    s.game.resume();
    runUntilTick(s, 300);

    const replay: Replay = s.game.replay();
    expect(replay).toMatchObject({ gameVersion: 'test', seed: 5, heroId: 'male', mode: 'day' });
    expect(replay.inputs.length).toBeLessThan(12);
    expect(replayAsServer(s.game)).toEqual(s.game.result());
  });

  it('keeps the result of the tick the run ended, while the world moves on', () => {
    const s = setup(1);
    s.game.start();
    s.fake.frame();
    while (s.game.getHud().status === 'playing') {
      s.fake.frame();
    }
    const ended = s.game.result();
    const replayAtEnd = s.game.replay();

    for (let i = 0; i < 120; i += 1) {
      s.fake.frame();
    }

    expect(ended.status).toBe('lost');
    expect(s.view().tick).toBeGreaterThan(ended.ticks);
    expect(s.game.result()).toEqual(ended);
    expect(s.game.replay()).toEqual(replayAtEnd);
    expect(simulate(replayAtEnd, { maxTicks: 60 * 60 * 10 })).toEqual(ended);
  });

  const step = fc.oneof(
    fc.record({
      kind: fc.constantFrom('press' as const, 'release' as const),
      action: fc.constantFrom('moveUp' as const, 'moveDown' as const, 'fire' as const),
      frames: fc.integer({ min: 0, max: 30 }),
    }),
    fc.record({ kind: fc.constant('pause' as const), frames: fc.integer({ min: 0, max: 5 }) }),
  );

  test.prop([fc.nat({ max: 0xff_ff_ff_ff }), fc.array(step, { maxLength: 60 })])(
    'gives simulate the same hash for any play through the browser path',
    (seed, steps) => {
      const s = setup(seed);
      s.game.start();
      s.fake.frame();
      for (const action of steps) {
        if (action.kind === 'pause') {
          s.input.press('pause', 'key:Escape');
          s.fake.frame();
          s.input.release('pause', 'key:Escape');
          s.game.resume();
        } else if (action.kind === 'press') {
          s.input.press(action.action, `key:${action.action}`);
        } else {
          s.input.release(action.action, `key:${action.action}`);
        }
        for (let i = 0; i < action.frames; i += 1) {
          s.fake.frame();
        }
      }

      expect(replayAsServer(s.game)).toEqual(s.game.result());
    },
  );
});
