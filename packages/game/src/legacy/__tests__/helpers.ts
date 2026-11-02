import { Game } from '../Game';
import type { GameSettings } from '../settings';

interface GameOptions {
  mode?: GameSettings['mode'];
  hero?: 'male' | 'female';
  width?: number;
  height?: number;
}

/** A legacy game with silent sound effects; 800 x 600, Mike, daytime unless told otherwise. */
export function createGame(options: GameOptions = {}): Game {
  return new Game(options.width ?? 800, options.height ?? 600, options.hero ?? 'male', {
    mode: options.mode ?? 'day',
    volume: 0,
  });
}

/**
 * The legacy timers fire on the update *after* the accumulated time exceeds the interval (the
 * comparison is strict and happens before the delta is added). This helper reproduces that.
 */
export function advancePast(game: Game, intervalMs: number): void {
  game.update(intervalMs);
  game.update(1);
  game.update(0);
}
