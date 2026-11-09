import type { AssetFailure, AudioMixer } from '@buzzkill/engine';
import type { GameMode, GameSound, HeroId, RunResult } from '@buzzkill/game';

import type { GameSprites } from '../game/sprites';
import { createStore, type Store } from './store';

/** What a run draws and plays: loaded once at boot and shared by every run of the visit. */
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
}

/** The screens of the menu: the main menu and the two it opens. */
export type MenuPanel = 'main' | 'settings' | 'help';

/**
 * The flow of the shell (ADR-0006). `boot` loads the assets, with the failures of the last attempt
 * while it waits for a retry; every later state carries the assets; `menu` says which of its
 * panels is open; the four run states carry the run, and the two final ones its result. A pause
 * dialog on the menu or a game over without a run cannot be written.
 */
export type AppState =
  | {
      readonly name: 'boot';
      readonly attempt: number;
      readonly failures: readonly AssetFailure[] | null;
    }
  | { readonly name: 'menu'; readonly panel: MenuPanel; readonly assets: GameAssets }
  | { readonly name: 'heroSelect'; readonly assets: GameAssets }
  | { readonly name: 'playing'; readonly assets: GameAssets; readonly run: Run }
  | { readonly name: 'paused'; readonly assets: GameAssets; readonly run: Run }
  | {
      readonly name: 'levelComplete';
      readonly assets: GameAssets;
      readonly run: Run;
      readonly result: RunResult;
    }
  | {
      readonly name: 'gameOver';
      readonly assets: GameAssets;
      readonly run: Run;
      readonly result: RunResult;
    };

/** The states with a run: the canvas is on screen and a `Game` exists. */
export type RunState = Extract<AppState, { readonly run: Run }>;

/**
 * What moves the flow: the outcome of the boot (`booted`, `bootFailed`), the player's choices
 * (`retry`, `openSettings`, `openHelp`, `selectHero`, `back`, `play`, `pause`, `resume`, `quit`)
 * and what the game reports through the bridge (`gamePaused`, `gameResumed`, `runEnded`). A
 * command and the game's own report of the same fact are separate events, so the table shows who
 * may cause what.
 */
export type AppEvent =
  | { readonly type: 'booted'; readonly assets: GameAssets }
  | { readonly type: 'bootFailed'; readonly failures: readonly AssetFailure[] }
  | { readonly type: 'retry' }
  | { readonly type: 'openSettings' }
  | { readonly type: 'openHelp' }
  | { readonly type: 'selectHero' }
  | { readonly type: 'back' }
  | { readonly type: 'play'; readonly run: Run }
  | { readonly type: 'pause' }
  | { readonly type: 'resume' }
  | { readonly type: 'gamePaused' }
  | { readonly type: 'gameResumed' }
  | { readonly type: 'runEnded'; readonly result: RunResult }
  | { readonly type: 'quit' };

export const initialState: AppState = { name: 'boot', attempt: 0, failures: null };

export function isRunState(state: AppState): state is RunState {
  return (
    state.name === 'playing' ||
    state.name === 'paused' ||
    state.name === 'levelComplete' ||
    state.name === 'gameOver'
  );
}

/**
 * The transition table, one case per event: the states it applies to and the state it leads to.
 * Every other combination returns `state` itself, so the store skips the notification. Pure: the
 * effects (loading, creating and disposing a run, the theme) are React effects keyed on the
 * state, and the docs/architecture.md diagram draws exactly these arrows.
 */
export function transition(state: AppState, event: AppEvent): AppState {
  switch (event.type) {
    case 'booted':
      return state.name === 'boot' ? { name: 'menu', panel: 'main', assets: event.assets } : state;
    case 'bootFailed':
      return state.name === 'boot'
        ? { name: 'boot', attempt: state.attempt, failures: event.failures }
        : state;
    case 'retry':
      return state.name === 'boot' && state.failures !== null
        ? { name: 'boot', attempt: state.attempt + 1, failures: null }
        : state;
    case 'openSettings':
      return state.name === 'menu' && state.panel === 'main'
        ? { ...state, panel: 'settings' }
        : state;
    case 'openHelp':
      return state.name === 'menu' && state.panel === 'main' ? { ...state, panel: 'help' } : state;
    case 'selectHero':
      return state.name === 'menu' && state.panel === 'main'
        ? { name: 'heroSelect', assets: state.assets }
        : state;
    case 'back':
      if (state.name === 'heroSelect' || (state.name === 'menu' && state.panel !== 'main')) {
        return { name: 'menu', panel: 'main', assets: state.assets };
      }
      return state;
    case 'play':
      return state.name === 'heroSelect' ||
        state.name === 'levelComplete' ||
        state.name === 'gameOver'
        ? { name: 'playing', assets: state.assets, run: event.run }
        : state;
    case 'pause':
    case 'gamePaused':
      return state.name === 'playing'
        ? { name: 'paused', assets: state.assets, run: state.run }
        : state;
    case 'resume':
    case 'gameResumed':
      return state.name === 'paused'
        ? { name: 'playing', assets: state.assets, run: state.run }
        : state;
    case 'quit':
      return isRunState(state) ? { name: 'menu', panel: 'main', assets: state.assets } : state;
    case 'runEnded': {
      if (state.name !== 'playing') {
        return state;
      }
      const { assets, run } = state;
      switch (event.result.status) {
        case 'playing':
          return state;
        case 'won':
          return { name: 'levelComplete', assets, run, result: event.result };
        case 'lost':
          return { name: 'gameOver', assets, run, result: event.result };
      }
    }
  }
}

export type AppStore = Store<AppState, AppEvent>;

/** The store of the flow; `initial` lets a test start in any state. */
export function createAppStore(initial: AppState = initialState): AppStore {
  return createStore(transition, initial);
}
