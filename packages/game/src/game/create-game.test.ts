import { type ActionInput, createActionInput, type GameLoopHost } from '@buzzkill/engine';
import { describe, expect, it, vi } from 'vitest';

import { GAME_ACTIONS, type GameAction } from '../actions';
import { RULES } from '../config/rules';
import { createSimulation } from '../simulation/simulation';
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
    settings: { heroId: 'male', mode: 'day' },
    seed,
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
        settings: { heroId: 'female', mode: 'night' },
        seed: 1,
        input,
        host: fake.host,
        renderer: { render: vi.fn() },
        audio: { play: vi.fn() },
      }),
    ).toThrow(/GAME_ACTIONS in order/);
  });
});
