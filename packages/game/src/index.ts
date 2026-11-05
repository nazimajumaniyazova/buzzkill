/**
 * Public API of the game package. The package has no DOM types on purpose, so the simulation can
 * run headless in Node and in edge functions.
 */
export {
  DEFAULT_GAMEPAD_BINDINGS,
  DEFAULT_KEY_BINDINGS,
  GAME_ACTIONS,
  type GameAction,
} from './actions';
export {
  DAY_ENEMIES,
  ENEMY_SETS,
  type EnemyConfig,
  type GameMode,
  type IntRange,
  NIGHT_ENEMIES,
  type Range,
} from './config/enemies';
export { type HeroConfig, HEROES, type HeroId, RULES, WORLD } from './config/rules';
export {
  createGame,
  type CreateGameOptions,
  type Game,
  type GameAudio,
  type GameHud,
  type GameRenderer,
  type GameSettings,
  type GameSound,
  type GameView,
} from './game/create-game';
export {
  deserializeReplay,
  MAX_REPLAY_CHANGES,
  parseReplay,
  type Replay,
  REPLAY_ACTION_MASK,
  REPLAY_FORMAT_VERSION,
  type ReplayParseResult,
  serializeReplay,
} from './replay/format';
export {
  createReplayRecorder,
  type ReplayRecorder,
  type ReplayRecorderOptions,
} from './replay/recorder';
export { hashGameState, type RunResult } from './replay/result';
export { simulate, type SimulateOptions } from './replay/simulate';
export { animationFrame, parallaxOffset } from './simulation/presentation';
export { type GameStatus } from './simulation/rules';
export { createSimulation, type Simulation, type SimulationOptions } from './simulation/simulation';
export type { GameEvents, GameState, TickInput } from './simulation/state';
export { type EntityId, Kind, type World } from './world/world';
