/**
 * Public API of the engine package. Everything the game or the app may use is
 * exported from here; deep imports into `src/` are not allowed.
 */
export {
  applyCanvasFit,
  type CanvasFit,
  type CanvasFitOptions,
  type CanvasLike,
  computeCanvasFit,
  fitContain,
  type Size,
} from './canvas/fit-canvas';
export { type Aabb, aabbOverlaps, boxesOverlap } from './collision/aabb';
export {
  createSpatialHash,
  type SpatialHash,
  type SpatialHashOptions,
} from './collision/spatial-hash';
export { createEventBus, type EventBus, type EventListener } from './events/event-bus';
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
export { clamp } from './math/clamp';
export { createRng, type Rng, type RngState } from './math/rng';
export { cos, sin } from './math/trig';
export { createPool, type Pool, type PoolOptions } from './pool/object-pool';
