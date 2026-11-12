import { type Game, isRunOver, timeAfterLevel } from '@buzzkill/game';

import type { AppEvent } from './machine';

/** The events the game itself causes. */
export type GameEvent = Extract<
  AppEvent,
  { type: 'gamePaused' | 'gameResumed' | 'levelCleared' | 'runEnded' }
>;

/**
 * The bridge from a run to the machine: a pause or a resume of the game, a cleared level with the
 * time of day of the next one, and the end of the run become events. Score, lives and ammo never reach the machine; the HUD reads them from
 * `game.getHud()` with its own `useSyncExternalStore`. Returns the function that disconnects.
 */
export function connectGame(game: Game, send: (event: GameEvent) => void): () => void {
  let last = game.getHud();
  return game.subscribe((hud) => {
    if (hud.paused !== last.paused) {
      send({ type: hud.paused ? 'gamePaused' : 'gameResumed' });
    }
    if (hud.status !== last.status && hud.status === 'levelCleared') {
      // The game holds the run here until `nextLevel()` (ADR-0017).
      send({
        type: 'levelCleared',
        level: hud.level,
        score: hud.score,
        nextTime: timeAfterLevel(hud.level, hud.mode),
      });
    }
    // The world moves on for the picture after the end, so the status changes exactly once.
    if (hud.status !== last.status && isRunOver(hud.status)) {
      send({ type: 'runEnded', result: game.result() });
    }
    last = hud;
  });
}
