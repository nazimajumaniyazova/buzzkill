/**
 * Headless public API of the engine package: compiles without the DOM lib, so the game and the
 * server can import it. The DOM adapters are in `@buzzkill/engine/browser`. Deep imports into
 * `src/` are not allowed.
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
export { createFnv1a, type Fnv1a } from './hash/fnv1a';
export {
  type ActionInput,
  createActionInput,
  type InputSnapshot,
  isActionDown,
} from './input/action-input';
export {
  type AxisBinding,
  type GamepadBindings,
  type KeyBindings,
  rebindKey,
} from './input/bindings';
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
