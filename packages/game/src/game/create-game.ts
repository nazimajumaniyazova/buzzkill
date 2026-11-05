import {
  type ActionInput,
  createEventBus,
  createGameLoop,
  type GameLoopHost,
} from '@buzzkill/engine';

import { GAME_ACTIONS, type GameAction } from '../actions';
import type { GameMode } from '../config/enemies';
import { type HeroId, WORLD } from '../config/rules';
import type { Replay } from '../replay/format';
import { createReplayRecorder } from '../replay/recorder';
import { type RunResult, runResultOf } from '../replay/result';
import type { GameStatus } from '../simulation/rules';
import { createSimulation } from '../simulation/simulation';
import type { GameState } from '../simulation/state';

/** The choices a run starts with. Volume and key bindings belong to the audio and input adapters. */
export interface GameSettings {
  readonly heroId: HeroId;
  readonly mode: GameMode;
}

/**
 * What a renderer may read: the world and the values of the run. The RNG and the event bus are
 * left out on purpose, so drawing can never change the course of a run.
 */
export type GameView = Pick<
  GameState,
  'world' | 'tick' | 'status' | 'mode' | 'heroId' | 'hero' | 'enemies' | 'player'
>;

/** Draws the run. The Canvas 2D implementation arrives with #35. */
export interface GameRenderer {
  /**
   * Called once per displayed frame. `alpha` in [0, 1) is how far the next tick already is, for
   * interpolating between `prevX`/`prevY` and `x`/`y`.
   */
  render(view: GameView, alpha: number): void;
}

/** The sound effects of the game, the three of the 2023 version. */
export type GameSound = 'shot' | 'explosion' | 'hit';

/** Plays sound effects. The Web Audio implementation arrives with #36. */
export interface GameAudio {
  play(sound: GameSound): void;
}

/** The values the HUD shows. A new object is published only when one of them changes. */
export interface GameHud {
  readonly score: number;
  readonly lives: number;
  readonly ammo: number;
  readonly status: GameStatus;
  /** True while the run is paused by the `pause` action or by `pause()`. */
  readonly paused: boolean;
}

export interface CreateGameOptions {
  readonly settings: GameSettings;
  /** 32-bit seed of the run. A replay stores it, so it is a number, not an RNG object. */
  readonly seed: number;
  /** The build of `@buzzkill/game` that runs, written into the replay. */
  readonly gameVersion: string;
  /** Input over `GAME_ACTIONS` in that order; the caller attaches the keyboard, touch and pads. */
  readonly input: ActionInput<GameAction>;
  /** Frame scheduling: `createBrowserHost()` in the browser, a fake in tests. */
  readonly host: GameLoopHost;
  readonly renderer: GameRenderer;
  readonly audio: GameAudio;
}

export interface Game {
  /** Starts the run from tick 0. Does nothing once started or disposed. */
  start(): void;
  /** Holds the run: no ticks, no frames. Publishes `paused: true`. */
  pause(): void;
  /** Continues a paused run from the same tick. Publishes `paused: false`. */
  resume(): void;
  /** Stops the loop and drops every listener. The game cannot be used afterwards. */
  dispose(): void;
  /**
   * Calls `listener` with the new HUD values whenever one of them changes, at most once per
   * frame. Returns the function that removes it. Fits React's `useSyncExternalStore` together
   * with `getHud`.
   */
  subscribe(listener: (hud: GameHud) => void): () => void;
  /** The current HUD values; the same object until one of them changes. */
  getHud(): GameHud;
  /**
   * The replay of the run so far: every simulated tick until the run ended. `simulate` with it
   * gives the same result as `result()`.
   */
  replay(): Replay;
  /** The result at the tick the run was won or lost, or at the current tick while it goes on. */
  result(): RunResult;
}

/**
 * Creates a playable run: the headless simulation driven by the engine's fixed-step loop, with
 * the input, the frame host, the renderer and the audio passed in. Nothing is global, so two
 * games can run side by side and tests replace every edge with a fake.
 *
 * The shell talks to the run only through the returned object. The HUD is pushed, not polled:
 * a 60 Hz simulation must not cause 60 React renders per second (docs/architecture.md).
 */
export function createGame(options: CreateGameOptions): Game {
  const { settings, input, renderer, audio } = options;
  if (input.actions.join() !== GAME_ACTIONS.join()) {
    // The systems read the input masks by bit position, so the order of the actions matters.
    throw new Error(
      `createGame: the input must use GAME_ACTIONS in order (${GAME_ACTIONS.join(', ')})`,
    );
  }
  const pauseBit = input.bit('pause');
  const recorder = createReplayRecorder({
    gameVersion: options.gameVersion,
    seed: options.seed,
    heroId: settings.heroId,
    mode: settings.mode,
  });
  /** The input of the tick being simulated, reused: a tick allocates nothing. */
  const tickInput = { down: 0, pressed: 0 };
  let finalResult: RunResult | null = null;

  const simulation = createSimulation({
    seed: options.seed,
    heroId: settings.heroId,
    mode: settings.mode,
  });
  const { state } = simulation;

  // The bus belongs to this run, so `dispose` clears these with everything else on it.
  state.events.on('shot', () => {
    audio.play('shot');
  });
  state.events.on('explosion', () => {
    audio.play('explosion');
  });
  state.events.on('playerHit', () => {
    audio.play('hit');
  });

  const hudBus = createEventBus<{ change: GameHud }>();
  let paused = false;
  let disposed = false;
  let hud: GameHud = snapshotHud(state, paused);

  /** Publishes the HUD if any value differs from the last published one. */
  const publishHud = (): void => {
    if (
      hud.score === state.score &&
      hud.lives === state.lives &&
      hud.ammo === state.ammo &&
      hud.status === state.status &&
      hud.paused === paused
    ) {
      return;
    }
    hud = snapshotHud(state, paused);
    hudBus.emit('change', hud);
  };

  const loop = createGameLoop(
    {
      update() {
        // A pause from the input stops the loop, but the frame still runs its remaining ticks.
        if (paused) {
          return;
        }
        const snapshot = input.sample();
        if ((snapshot.pressed & pauseBit) !== 0) {
          // The tick that sees the pause press is not simulated, so a replay never contains it.
          pause();
          return;
        }
        if (state.status !== 'playing') {
          // The run ended in the previous tick, so the state is still the one `simulate` stops
          // at. The world then moves on for the picture, but nothing more is recorded.
          finalResult ??= runResultOf(state);
          simulation.step(tickInput);
          return;
        }
        // Only the down mask is recorded, so `pressed` is derived from it here exactly as
        // `simulate` derives it from the replay. The input's own `pressed` would differ after a
        // pause, whose tick is sampled but not simulated.
        const down = snapshot.down & ~pauseBit;
        tickInput.pressed = down & ~tickInput.down;
        tickInput.down = down;
        recorder.recordInput(state.tick + 1, down);
        simulation.step(tickInput);
      },
      render(alpha) {
        // Once per frame rather than once per tick: a frame can run several ticks.
        publishHud();
        renderer.render(state, alpha);
      },
    },
    { host: options.host, hz: WORLD.ticksPerSecond },
  );

  function pause(): void {
    if (disposed || paused || loop.status !== 'running') {
      return;
    }
    paused = true;
    loop.pause();
    publishHud();
  }

  return {
    start() {
      if (!disposed) {
        loop.start();
      }
    },
    pause,
    resume() {
      if (disposed || !paused) {
        return;
      }
      paused = false;
      loop.resume();
      publishHud();
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      loop.stop();
      state.events.clear();
      hudBus.clear();
    },
    subscribe(listener) {
      if (disposed) {
        return () => undefined;
      }
      return hudBus.on('change', listener);
    },
    getHud() {
      return hud;
    },
    replay() {
      return recorder.replay();
    },
    result() {
      return finalResult ?? runResultOf(state);
    },
  };
}

function snapshotHud(state: GameState, paused: boolean): GameHud {
  return {
    score: state.score,
    lives: state.lives,
    ammo: state.ammo,
    status: state.status,
    paused,
  };
}
