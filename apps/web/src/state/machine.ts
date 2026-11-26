import type { AudioMixer } from '@buzzkill/engine';
import type { Difficulty, GameMode, GameSound, HeroId, Replay, RunResult } from '@buzzkill/game';

import type { ReplayProblem } from '../backend/replays';
import type { MusicPlayer } from '../game/music';
import type { GameSprites } from '../game/sprites';
import type { GameSpeed } from './settings/schema';
import { createStore, type Store } from './store';

/** What a run draws and plays: loaded once, on demand (#112), and shared by every run of the visit. */
export interface GameAssets {
  readonly sprites: GameSprites<ImageBitmap>;
  readonly audio: AudioMixer<GameSound>;
  readonly music: MusicPlayer;
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
  /** The UTC date of a daily run (#165), whose seed is the day's; `null` for any other run. */
  readonly daily: string | null;
}

/**
 * Why a run is paused: the player asked, by the pause key, the button or the game's own pause, or
 * the gamepad went away in the middle of it (#154), which the pause dialog says.
 */
export type PauseReason = 'player' | 'gamepadLost';

/** The screens of the menu: the main menu and the three it opens. */
export type MenuPanel = 'main' | 'settings' | 'help' | 'achievements' | 'boards';

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

/** How a run ended: the result, and the replay the game recorded of it (#219). */
interface Finish {
  readonly result: RunResult;
  readonly replay: Replay;
}

/**
 * The loading of a stored run's replay (#219): its replay is fetched first, then the game's code
 * and files, unless they are there already; `ready` plays it at the time of day on screen.
 */
type StoredReplayLoad =
  | { readonly status: 'fetching' }
  | { readonly status: 'failed'; readonly problem: ReplayProblem }
  | { readonly status: 'fetched'; readonly replay: Replay }
  | {
      readonly status: 'ready';
      readonly replay: Replay;
      readonly assets: GameAssets;
      readonly time: GameMode;
    };

/** The two states of a finished run, which a replay goes back to. */
type FinishedState = Extract<AppState, { readonly name: 'victory' | 'gameOver' }>;

/**
 * The flow of the shell (ADR-0006). It starts on the menu, before the game's code and files have
 * downloaded (#112); `menu` says which of its panels is open. `loading` holds the run the player
 * chose while the game finishes loading. The six run states carry the loaded assets, the run and
 * the time of day on screen; `levelCleared` is the screen between levels, and the two final ones
 * carry the result and the replay. `watching` plays that replay over the finished run (#219), whose
 * state it keeps to go back to; its time of day is the replay's. `storedReplay` plays the replay of
 * a run of the boards, by its id, and goes back to them. `failed` is the error screen of a
 * run that stopped on an unexpected error (#113); the run is gone by then. A pause dialog on the
 * menu, a game over without a run or a run without its assets cannot be written.
 */
export type AppState =
  | { readonly name: 'menu'; readonly panel: MenuPanel }
  | {
      readonly name: 'heroSelect';
      /** The date of the daily run being set up (#165), or `null` for a run of the player's own. */
      readonly daily: string | null;
    }
  | { readonly name: 'loading'; readonly run: Run }
  | ({ readonly name: 'playing' } & OnScreen)
  | ({ readonly name: 'paused'; readonly reason: PauseReason } & OnScreen)
  | ({
      readonly name: 'levelCleared';
      /** The level just cleared, from 1. */
      readonly level: number;
      readonly score: number;
      /** The time of day of the next level. */
      readonly nextTime: GameMode;
    } & OnScreen)
  | ({ readonly name: 'victory' } & Finish & OnScreen)
  | ({ readonly name: 'gameOver' } & Finish & OnScreen)
  | ({ readonly name: 'watching'; readonly finished: FinishedState } & OnScreen)
  | { readonly name: 'storedReplay'; readonly runId: string; readonly load: StoredReplayLoad }
  | { readonly name: 'failed' };

/** The states of a run on screen: the canvas is there and a `Game` exists. */
export type RunState = Extract<AppState, { readonly assets: GameAssets }>;

/**
 * What moves the flow: the player's choices (`openSettings`, `openHelp`, `openAchievements`,
 * `openBoards`, `selectHero`, `selectDaily`, `back`, `play`, `pause`, `resume`, `nextLevel`,
 * `quit`, `restart`, `watchReplay`), the end of the game's loading (`gameLoaded`), what the game
 * reports through the bridge (`gamePaused`, `gameResumed`, `levelCleared`, `runEnded`), the time of
 * day of a replay (`replayTime`), a gamepad lost during a run (`gamepadLost`, #154), the error
 * boundary around the run (`runFailed`), and a run of the boards to watch (`watchRun`) with the
 * answer for its replay (`replayFetched`, `replayFailed`, #219). A command and the game's own report of the same fact are
 * separate events, so the table shows who may cause what.
 */
export type AppEvent =
  | { readonly type: 'openSettings' }
  | { readonly type: 'openHelp' }
  | { readonly type: 'openAchievements' }
  | { readonly type: 'openBoards' }
  | { readonly type: 'selectHero' }
  /** The daily challenge of `date`, the UTC date when the player chose it (#165). */
  | { readonly type: 'selectDaily'; readonly date: string }
  | { readonly type: 'back' }
  | { readonly type: 'play'; readonly run: Run }
  | { readonly type: 'gameLoaded'; readonly assets: GameAssets }
  | { readonly type: 'pause' }
  | { readonly type: 'resume' }
  | { readonly type: 'gamePaused' }
  | { readonly type: 'gameResumed' }
  | { readonly type: 'gamepadLost' }
  | ({ readonly type: 'runEnded' } & Finish)
  | {
      readonly type: 'levelCleared';
      readonly level: number;
      readonly score: number;
      readonly nextTime: GameMode;
    }
  | { readonly type: 'nextLevel' }
  | { readonly type: 'quit' }
  | { readonly type: 'runFailed' }
  | { readonly type: 'restart' }
  | { readonly type: 'watchReplay' }
  /** The replay on screen reached a level at another time of day (ADR-0017). */
  | { readonly type: 'replayTime'; readonly time: GameMode }
  /** The player chose to watch a run of the boards, or to try again after a failure. */
  | { readonly type: 'watchRun'; readonly runId: string }
  | { readonly type: 'replayFetched'; readonly runId: string; readonly replay: Replay }
  | { readonly type: 'replayFailed'; readonly runId: string; readonly problem: ReplayProblem };

export const initialState: AppState = { name: 'menu', panel: 'main' };

export function isRunState(state: AppState): state is RunState {
  return (
    state.name === 'playing' ||
    state.name === 'paused' ||
    state.name === 'levelCleared' ||
    state.name === 'victory' ||
    state.name === 'gameOver' ||
    state.name === 'watching'
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
    case 'openAchievements':
      return state.name === 'menu' && state.panel === 'main'
        ? { ...state, panel: 'achievements' }
        : state;
    case 'openBoards':
      return state.name === 'menu' && state.panel === 'main'
        ? { ...state, panel: 'boards' }
        : state;
    case 'selectHero':
      return state.name === 'menu' && state.panel === 'main'
        ? { name: 'heroSelect', daily: null }
        : state;
    case 'selectDaily':
      return state.name === 'menu' && state.panel === 'main'
        ? { name: 'heroSelect', daily: event.date }
        : state;
    case 'back':
      if (state.name === 'heroSelect' || (state.name === 'menu' && state.panel !== 'main')) {
        return { name: 'menu', panel: 'main' };
      }
      if (state.name === 'watching') {
        return state.finished;
      }
      if (state.name === 'storedReplay') {
        return { name: 'menu', panel: 'boards' };
      }
      // The game goes on loading; Start again finds it further along.
      return state.name === 'loading' ? { name: 'heroSelect', daily: state.run.daily } : state;
    case 'play':
      if (state.name === 'heroSelect') {
        return { name: 'loading', run: event.run };
      }
      // A run is over: the assets are there, so the next one starts at once.
      return state.name === 'victory' || state.name === 'gameOver'
        ? { name: 'playing', assets: state.assets, run: event.run, time: event.run.mode }
        : state;
    case 'gameLoaded':
      if (state.name === 'storedReplay' && state.load.status === 'fetched') {
        const { replay } = state.load;
        return {
          ...state,
          load: { status: 'ready', replay, assets: event.assets, time: replay.mode },
        };
      }
      return state.name === 'loading'
        ? { name: 'playing', assets: event.assets, run: state.run, time: state.run.mode }
        : state;
    case 'pause':
    case 'gamePaused':
    case 'gamepadLost':
      return state.name === 'playing'
        ? {
            name: 'paused',
            assets: state.assets,
            run: state.run,
            time: state.time,
            reason: event.type === 'gamepadLost' ? 'gamepadLost' : 'player',
          }
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
      return isRunState(state) || (state.name === 'storedReplay' && state.load.status === 'ready')
        ? { name: 'failed' }
        : state;
    case 'restart':
      return state.name === 'failed' ? { name: 'menu', panel: 'main' } : state;
    case 'watchReplay':
      // The replay starts from its first level, at the time of day the run began.
      return state.name === 'victory' || state.name === 'gameOver'
        ? {
            name: 'watching',
            assets: state.assets,
            run: state.run,
            time: state.replay.mode,
            finished: state,
          }
        : state;
    case 'replayTime':
      if (
        state.name === 'storedReplay' &&
        state.load.status === 'ready' &&
        state.load.time !== event.time
      ) {
        return { ...state, load: { ...state.load, time: event.time } };
      }
      return state.name === 'watching' && state.time !== event.time
        ? { ...state, time: event.time }
        : state;
    case 'watchRun':
      return (state.name === 'menu' && state.panel === 'boards') ||
        (state.name === 'storedReplay' && state.load.status === 'failed')
        ? { name: 'storedReplay', runId: event.runId, load: { status: 'fetching' } }
        : state;
    case 'replayFetched':
    case 'replayFailed':
      if (
        state.name !== 'storedReplay' ||
        state.runId !== event.runId ||
        state.load.status !== 'fetching'
      ) {
        return state;
      }
      return event.type === 'replayFetched'
        ? { ...state, load: { status: 'fetched', replay: event.replay } }
        : { ...state, load: { status: 'failed', problem: event.problem } };
    case 'runEnded': {
      if (state.name !== 'playing') {
        return state;
      }
      const { assets, run, time } = state;
      const { result, replay } = event;
      switch (result.status) {
        // A cleared level is not the end of a run: it comes as `levelCleared` (ADR-0017).
        case 'playing':
        case 'levelCleared':
          return state;
        case 'won':
          return { name: 'victory', assets, run, time, result, replay };
        case 'lost':
          return { name: 'gameOver', assets, run, time, result, replay };
      }
    }
  }
}

export type AppStore = Store<AppState, AppEvent>;

/** The store of the flow; `initial` lets a test start in any state. */
export function createAppStore(initial: AppState = initialState): AppStore {
  return createStore(transition, initial);
}
