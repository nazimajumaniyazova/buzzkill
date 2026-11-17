/**
 * Public API of the game package. The package has no DOM types on purpose, so the simulation can
 * run headless in Node and in edge functions.
 */
export {
  ACHIEVEMENT_SCORE,
  type AchievementConfig,
  type AchievementCounts,
  type AchievementId,
  type AchievementProgress,
  ACHIEVEMENTS,
  followAchievements,
  type FollowOptions,
  noProgress,
  type RunContext,
  unlocked,
} from './achievements/achievements';
export {
  DEFAULT_GAMEPAD_BINDINGS,
  DEFAULT_KEY_BINDINGS,
  GAME_ACTIONS,
  type GameAction,
} from './actions';
export { type BossConfig, QUEEN } from './config/boss';
export {
  DIFFICULTIES,
  type Difficulty,
  DIFFICULTY_IDS,
  type DifficultyConfig,
} from './config/difficulty';
export {
  DAY_ENEMIES,
  ENEMY_SETS,
  type EnemyConfig,
  type GameMode,
  type IntRange,
  NIGHT_ENEMIES,
  type Range,
} from './config/enemies';
export { type LevelConfig, LEVELS, type WaveConfig } from './config/levels';
export {
  POWER_UP_RULES,
  POWER_UPS,
  type PowerUpConfig,
  type PowerUpKind,
} from './config/power-ups';
export { type HeroConfig, HEROES, type HeroId, RULES, WORLD } from './config/rules';
export { DAILY_RUN, dailyDate, dailySeed, isDailyDate } from './daily/daily';
export {
  createGame,
  type CreateGameOptions,
  type Game,
  type GameAudio,
  type GameEventSource,
  type GameHaptic,
  type GameHaptics,
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
export { animationFrame, isBossEnraged, parallaxOffset } from './simulation/presentation';
export { type GameStatus, isRunOver, timeAfterLevel } from './simulation/rules';
export { createSimulation, type Simulation, type SimulationOptions } from './simulation/simulation';
export type { GameEvents, GameState, TickInput } from './simulation/state';
export { type EntityId, Kind, type World } from './world/world';
