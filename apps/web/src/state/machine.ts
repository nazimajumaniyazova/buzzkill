import type { AudioMixer } from '@buzzkill/engine';
import type { Difficulty, GameMode, GameSound, HeroId, RunResult } from '@buzzkill/game';

import type { GameSprites } from '../game/sprites';
import type { GameSpeed } from './settings/schema';
import { createStore, type Store } from './store';

/** What a run draws and plays: loaded once, on demand (#112), and shared by every run of the visit. */
export interface GameAssets {
  readonly sprites: GameSprites<ImageBitmap>;
  readonly audio: AudioMixer<GameSound>;
}

/** What the player picks before a run. */
export interface RunChoice {
  readonly heroId: HeroId;
  readonly mode: GameMode;
}

/** One run as the player set it up, plus the seed that makes it reproducible. */
export interface Run extends RunChoice {
  readonly seed: number;
  /** The pace from the settings when the run started; it stays with the run (ADR-0014). */
  readonly speed: GameSpeed;
  /** The difficulty from the settings when the run started; its replay records it (#155). */
  readonly difficulty: Difficulty;
}

/** The screens of the menu: the main menu and the two it opens. */
export type MenuPanel = 'main' | 'settings' | 'help';

/** What every state of a run on screen holds. */
interface OnScreen {
  readonly assets: GameAssets;
  readonly run: Run;
  /**
   * The time of day of the level on screen: the run's choice at first, then whatever the levels
   * make it (ADR-0017). The page's theme follows it.
   */
  readonly time: GameMode;
}

/**
 * The flow of the shell (ADR-0006). It starts on the menu, before the game's code and files have
 * downloaded (#112); `menu` says which of its panels is open. `loading` holds the run the player
 * chose while the game finishes loading. The five run states carry the loaded assets, the run and
 * the time of day on screen; `levelCleared` is the screen between levels, and the two final ones
 * carry the result. `failed` is the error screen of a run that stopped on an unexpected error
 * (#113); the run is gone by then. A pause dialog on the menu, a game over without a run or a run
 * without its assets cannot be written.
 */
export type AppState =
  | { readonly name: 'menu'; readonly panel: MenuPanel }
  | { readonly name: 'heroSelect' }
  | { readonly name: 'loading'; readonly run: Run }
  | ({ readonly name: 'playing' } & OnScreen)
  | ({ readonly name: 'paused' } & OnScreen)
  | ({
      readonly name: 'levelCleared';
      /** The level just cleared, from 1. */
      readonly level: number;
      readonly score: number;
      /** The time of day of the next level. */
      readonly nextTime: GameMode;
    } & OnScreen)
  | ({ readonly name: 'victory'; readonly result: RunResult } & OnScreen)
  | ({ readonly name: 'gameOver'; readonly result: RunResult } & OnScreen)
  | { readonly name: 'failed' };

/** The states of a run on screen: the canvas is there and a `Game` exists. */
export type RunState = Extract<AppState, { readonly assets: GameAssets }>;

/**
 * What moves the flow: the player's choices (`openSettings`, `openHelp`, `selectHero`, `back`,
 * `play`, `pause`, `resume`, `nextLevel`, `quit`, `restart`), the end of the game's loading
 * (`gameLoaded`), what the game reports through the bridge (`gamePaused`, `gameResumed`,
 * `levelCleared`, `runEnded`) and the error boundary around the run (`runFailed`). A command and the game's own report of the same
 * fact are separate events, so the table shows who may cause what.
 */
export type AppEvent =
  | { readonly type: 'openSettings' }
  | { readonly type: 'openHelp' }
  | { readonly type: 'selectHero' }
  | { readonly type: 'back' }
  | { readonly type: 'play'; readonly run: Run }
  | { readonly type: 'gameLoaded'; readonly assets: GameAssets }
  | { readonly type: 'pause' }
  | { readonly type: 'resume' }
  | { readonly type: 'gamePaused' }
  | { readonly type: 'gameResumed' }
  | { readonly type: 'runEnded'; readonly result: RunResult }
  | {
      readonly type: 'levelCleared';
      readonly level: number;
      readonly score: number;
      readonly nextTime: GameMode;
    }
  | { readonly type: 'nextLevel' }
  | { readonly type: 'quit' }
  | { readonly type: 'runFailed' }
  | { readonly type: 'restart' };

export const initialState: AppState = { name: 'menu', panel: 'main' };

export function isRunState(state: AppState): state is RunState {
  return (
    state.name === 'playing' ||
    state.name === 'paused' ||
    state.name === 'levelCleared' ||
    state.name === 'victory' ||
    state.name === 'gameOver'
  );
}

/**
 * The transition table, one case per event: the states it applies to and the state it leads to.
 * Every other combination returns `state` itself, so the store skips the notification. Pure: the
 * effects (loading, creating and disposing a run, the theme) live outside it, and the
 * docs/architecture.md diagram draws exactly these arrows.
 */
export function transition(state: AppState, event: AppEvent): AppState {
  switch (event.type) {
    case 'openSettings':
      return state.name === 'menu' && state.panel === 'main'
        ? { ...state, panel: 'settings' }
        : state;
    case 'openHelp':
      return state.name === 'menu' && state.panel === 'main' ? { ...state, panel: 'help' } : state;
    case 'selectHero':
      return state.name === 'menu' && state.panel === 'main' ? { name: 'heroSelect' } : state;
    case 'back':
      if (state.name === 'heroSelect' || (state.name === 'menu' && state.panel !== 'main')) {
        return { name: 'menu', panel: 'main' };
      }
      // The game goes on loading; Start again finds it further along.
      return state.name === 'loading' ? { name: 'heroSelect' } : state;
    case 'play':
      if (state.name === 'heroSelect') {
        return { name: 'loading', run: event.run };
      }
      // A run is over: the assets are there, so the next one starts at once.
      return state.name === 'victory' || state.name === 'gameOver'
        ? { name: 'playing', assets: state.assets, run: event.run, time: event.run.mode }
        : state;
    case 'gameLoaded':
      return state.name === 'loading'
        ? { name: 'playing', assets: event.assets, run: state.run, time: state.run.mode }
        : state;
    case 'pause':
    case 'gamePaused':
      return state.name === 'playing'
        ? { name: 'paused', assets: state.assets, run: state.run, time: state.time }
        : state;
    case 'resume':
    case 'gameResumed':
      return state.name === 'paused'
        ? { name: 'playing', assets: state.assets, run: state.run, time: state.time }
        : state;
    case 'levelCleared': {
      if (state.name !== 'playing') {
        return state;
      }
      const { assets, run, time } = state;
      const { level, score, nextTime } = event;
      return { name: 'levelCleared', assets, run, time, level, score, nextTime };
    }
    case 'nextLevel':
      return state.name === 'levelCleared'
        ? { name: 'playing', assets: state.assets, run: state.run, time: state.nextTime }
        : state;
    case 'quit':
      return isRunState(state) ? { name: 'menu', panel: 'main' } : state;
    case 'runFailed':
      // Leaving the run states unmounts the game view, which disposes the run.
      return isRunState(state) ? { name: 'failed' } : state;
    case 'restart':
      return state.name === 'failed' ? { name: 'menu', panel: 'main' } : state;
    case 'runEnded': {
      if (state.name !== 'playing') {
        return state;
      }
      const { assets, run, time } = state;
      switch (event.result.status) {
        // A cleared level is not the end of a run: it comes as `levelCleared` (ADR-0017).
        case 'playing':
        case 'levelCleared':
          return state;
        case 'won':
          return { name: 'victory', assets, run, time, result: event.result };
        case 'lost':
          return { name: 'gameOver', assets, run, time, result: event.result };
      }
    }
  }
}

export type AppStore = Store<AppState, AppEvent>;

/** The store of the flow; `initial` lets a test start in any state. */
export function createAppStore(initial: AppState = initialState): AppStore {
  return createStore(transition, initial);
}
