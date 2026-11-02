/**
 * Public API of the game package. `createGame` and the simulation types arrive with the engine
 * refactor. The package has no DOM types on purpose, so the simulation can run headless in Node
 * and in edge functions.
 */
export {
  DEFAULT_GAMEPAD_BINDINGS,
  DEFAULT_KEY_BINDINGS,
  GAME_ACTIONS,
  type GameAction,
} from './actions';
