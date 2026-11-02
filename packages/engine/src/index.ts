/**
 * Public API of the engine package. Everything the game or the app may use is
 * exported from here; deep imports into `src/` are not allowed.
 */
export { type BrowserHostGlobals, createBrowserHost } from './loop/browser-host';
export {
  createFixedTimestep,
  type FixedTimestep,
  type FixedTimestepOptions,
  type FrameAdvance,
} from './loop/fixed-timestep';
export {
  createGameLoop,
  type GameLoop,
  type GameLoopCallbacks,
  type GameLoopHost,
  type GameLoopOptions,
  type GameLoopStatus,
} from './loop/game-loop';
export { clamp } from './math';
