import {
  type ActionInput,
  createEventBus,
  createGameLoop,
  type GameLoopHost,
} from '@buzzkill/engine';

import { GAME_ACTIONS, type GameAction } from '../actions';
import type { Difficulty } from '../config/difficulty';
import type { GameMode } from '../config/enemies';
import { type HeroId, WORLD } from '../config/rules';
import type { Replay } from '../replay/format';
import { createReplayRecorder } from '../replay/recorder';
import { type RunResult, runResultOf } from '../replay/result';
import { isBossEnraged, secondsLeft } from '../simulation/presentation';
import { type GameStatus, isRunOver } from '../simulation/rules';
import { createSimulation } from '../simulation/simulation';
import type { GameEvents, GameState } from '../simulation/state';

/** The choices a run starts with. Volume and key bindings belong to the audio and input adapters. */
export interface GameSettings {
  readonly heroId: HeroId;
  readonly mode: GameMode;
  /** Fixed for the run and recorded in its replay (#155). */
  readonly difficulty: Difficulty;
  /**
   * The UTC date of a daily run (#165), recorded in its replay; the seed must be the day's. Any
   * other run has none.
   */
  readonly daily?: string | null;
}

/**
 * What a renderer may read: the world and the values of the run, and the boss's phase for her
 * rage and the warning before her charge (#152). The RNG and the event bus are left out on
 * purpose, so drawing can never change the course of a run.
 */
export type GameView = Pick<
  GameState,
  'world' | 'tick' | 'status' | 'mode' | 'heroId' | 'hero' | 'enemies' | 'player' | 'boss'
>;

/**
 * The run's events, to follow but not to emit: a renderer's effects react to them (#156), and so
 * do the achievements (#163). Its listeners go with the run when it is disposed.
 */
export interface GameEventSource {
  /** Registers a listener and returns the function that removes it. */
  on<K extends keyof GameEvents>(type: K, listener: (payload: GameEvents[K]) => void): () => void;
}

/** Draws the run. The Canvas 2D implementation arrives with #35. */
export interface GameRenderer {
  /**
   * Called once per displayed frame. `alpha` in [0, 1) is how far the next tick already is, for
   * interpolating between `prevX`/`prevY` and `x`/`y`.
   */
  render(view: GameView, alpha: number): void;
  /**
   * Called once, when the run is created, for effects that only draw: sparks where a shot hits,
   * debris and dust (#156). They see what happened without being able to change it.
   */
  listen?(events: GameEventSource): void;
}

/**
 * The sound effects of the game: the three of the 2023 version, a power-up's pickup (#151), and
 * the boss's phase changing, when she arrives and when her rage begins (#152).
 */
export type GameSound = 'shot' | 'explosion' | 'hit' | 'pickup' | 'bossPhase';

/** Plays sound effects. The Web Audio implementation arrives with #36. */
export interface GameAudio {
  /**
   * Plays `sound`, which happened at `x` in world units, for its place between the speakers
   * (#161); without `x`, it sounds from the middle.
   */
  play(sound: GameSound, x?: number): void;
}

/** What a run makes the player feel on a device that can: a hit on the hero (#162). */
export type GameHaptic = 'hit';

/**
 * Plays haptic feedback, as `GameAudio` plays sounds: the run says what happened, the adapter
 * decides whether and how the device answers. Optional, since many devices have nothing to answer
 * with; the run is the same without it.
 */
export interface GameHaptics {
  play(haptic: GameHaptic): void;
}

/** The values the HUD shows. A new object is published only when one of them changes. */
export interface GameHud {
  readonly score: number;
  readonly lives: number;
  readonly ammo: number;
  /** The level being played, from 1. */
  readonly level: number;
  /** The time of day of that level, which the level data may change between levels. */
  readonly mode: GameMode;
  readonly status: GameStatus;
  /** True while the run is paused by the `pause` action or by `pause()`. */
  readonly paused: boolean;
  /**
   * Whole seconds the shield still lasts, rounded up; 0 when there is none (#151). Seconds rather
   * than ticks, so the HUD changes once a second and not at 60 Hz.
   */
  readonly shield: number;
  /** Whole seconds rapid fire still lasts, rounded up; 0 when it is off. */
  readonly rapidFire: number;
  /** The boss's health left while she is in the world (#152); 0 once she falls, and without her. */
  readonly bossHealth: number;
  /** Her health when she arrived, while she is in the world; 0 without her, which hides her bar. */
  readonly bossMaxHealth: number;
  /** True from her rage through her charges until she falls. */
  readonly bossEnraged: boolean;
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
  /** Haptic feedback where the device has it (#162). */
  readonly haptics?: GameHaptics;
  /**
   * Called once each, when the run is created, to follow its events without emitting them: the
   * achievements (#163). They see what happened and cannot change it.
   */
  readonly followers?: readonly ((events: GameEventSource) => void)[];
}

export interface Game {
  /** Starts the run from tick 0. Does nothing once started or disposed. */
  start(): void;
  /** Holds the run: no ticks, no frames. Publishes `paused: true`. */
  pause(): void;
  /** Continues a paused run from the same tick. Publishes `paused: false`. */
  resume(): void;
  /**
   * Starts the next level after a cleared one. A cleared level holds the run, with no ticks and no
   * frames, while the shell shows the screen between levels; those moments are never simulated,
   * so the replay does not depend on them (ADR-0017). Does nothing while no level is cleared.
   */
  nextLevel(): void;
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
  const { settings, input, renderer, audio, haptics } = options;
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
    difficulty: settings.difficulty,
    daily: settings.daily ?? null,
  });
  /** The input of the tick being simulated, reused: a tick allocates nothing. */
  const tickInput = { down: 0, pressed: 0 };
  let finalResult: RunResult | null = null;

  const simulation = createSimulation({
    seed: options.seed,
    heroId: settings.heroId,
    mode: settings.mode,
    difficulty: settings.difficulty,
  });
  const { state } = simulation;

  // The bus belongs to this run, so `dispose` clears these with everything else on it.
  state.events.on('shot', ({ x }) => {
    audio.play('shot', x);
  });
  state.events.on('explosion', ({ x }) => {
    audio.play('explosion', x);
  });
  state.events.on('playerHit', () => {
    // The blow lands on the hero, wherever it came from: the sound is where the hero is.
    const { world, player } = state;
    audio.play('hit', (world.x[player] ?? 0) + (world.width[player] ?? 0) / 2);
    haptics?.play('hit');
  });
  state.events.on('powerUpCollected', ({ x }) => {
    audio.play('pickup', x);
  });
  state.events.on('bossEntered', () => {
    audio.play('bossPhase');
  });
  state.events.on('bossEnraged', () => {
    audio.play('bossPhase');
  });
  const source: GameEventSource = { on: (type, listener) => state.events.on(type, listener) };
  renderer.listen?.(source);
  for (const follow of options.followers ?? []) {
    follow(source);
  }

  const hudBus = createEventBus<{ change: GameHud }>();
  let paused = false;
  /** Held on a cleared level until `nextLevel()`. */
  let held = false;
  let disposed = false;
  let hud: GameHud = snapshotHud(state, paused);

  /** Publishes the HUD if any value differs from the last published one. */
  const publishHud = (): void => {
    const boss = bossHud(state);
    if (
      hud.bossHealth === boss.health &&
      hud.bossMaxHealth === boss.maxHealth &&
      hud.bossEnraged === isBossEnraged(state.boss.phase) &&
      hud.score === state.score &&
      hud.lives === state.lives &&
      hud.ammo === state.ammo &&
      hud.level === state.level &&
      hud.mode === state.mode &&
      hud.status === state.status &&
      hud.paused === paused &&
      hud.shield === secondsLeft(state.shieldTicks) &&
      hud.rapidFire === secondsLeft(state.rapidFireTicks)
    ) {
      return;
    }
    hud = snapshotHud(state, paused);
    hudBus.emit('change', hud);
  };

  const loop = createGameLoop(
    {
      update() {
        // A pause or a cleared level stops the loop, but the frame still runs its remaining ticks.
        if (paused || held) {
          return;
        }
        const snapshot = input.sample();
        if ((snapshot.pressed & pauseBit) !== 0) {
          // The tick that sees the pause press is not simulated, so a replay never contains it.
          pause();
          return;
        }
        if (isRunOver(state.status)) {
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
        if (state.status === 'levelCleared') {
          held = true;
          loop.pause();
          publishHud();
        }
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
    nextLevel() {
      if (disposed || !held) {
        return;
      }
      held = false;
      loop.resume();
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

/** The boss's health and the most she had, both 0 while she is not in the world. */
function bossHud(state: GameState): { readonly health: number; readonly maxHealth: number } {
  const { id } = state.boss;
  if (id === undefined) {
    return NO_BOSS;
  }
  return {
    health: state.world.health[id] as number,
    maxHealth: state.world.value[id] as number,
  };
}

const NO_BOSS = { health: 0, maxHealth: 0 } as const;

function snapshotHud(state: GameState, paused: boolean): GameHud {
  const boss = bossHud(state);
  return {
    score: state.score,
    lives: state.lives,
    ammo: state.ammo,
    level: state.level,
    mode: state.mode,
    status: state.status,
    paused,
    shield: secondsLeft(state.shieldTicks),
    rapidFire: secondsLeft(state.rapidFireTicks),
    bossHealth: boss.health,
    bossMaxHealth: boss.maxHealth,
    bossEnraged: isBossEnraged(state.boss.phase),
  };
}
