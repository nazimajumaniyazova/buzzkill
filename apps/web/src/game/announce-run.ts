import type { Game } from '@buzzkill/game';

import type { Announce } from '../announcer';
import type { Messages } from '../i18n/en';

/**
 * Tells screen readers how a run goes (#114): its start and each new level, every life lost, and
 * its end. Game over
 * is said at once; everything else waits for what the reader is saying. It listens to the HUD the
 * game pushes, so nothing renders for it. Returns the function that stops listening.
 */
export function announceRun(
  game: Game,
  announce: Announce,
  messages: Messages['announce'],
): () => void {
  announce(messages.levelStart(game.result().level));
  let previous = game.getHud();
  return game.subscribe((hud) => {
    if (hud.status !== previous.status && hud.status === 'lost') {
      // The last life goes with the run: one message for both.
      announce(messages.gameOver(hud.score), 'assertive');
    } else if (hud.status !== previous.status && hud.status === 'won') {
      announce(messages.levelComplete(hud.score));
    } else if (hud.level > previous.level) {
      announce(messages.levelStart(hud.level));
    } else if (hud.lives < previous.lives) {
      announce(messages.lifeLost(hud.lives));
    }
    previous = hud;
  });
}
