import type { Game } from '@buzzkill/game';

import type { Announce } from '../announcer';
import type { Messages } from '../i18n/en';

/**
 * Tells screen readers how a run goes (#114): its start, each level cleared and started, the
 * queen's arrival, rage and defeat (#152), every life lost and gained, a shield or rapid fire
 * collected (#151), and its end. Game over is said at once; everything else waits for what the
 * reader is saying. Collected ammo is not said: the rounds count in the HUD, and a word for every
 * crate would drown the rest. Neither is each hit on the queen: her bar is a meter a reader can
 * visit. It listens to the HUD the game pushes, so nothing renders for it. Returns the function
 * that stops listening.
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
      announce(messages.victory(hud.score));
    } else if (hud.status !== previous.status && hud.status === 'levelCleared') {
      announce(messages.levelCleared(hud.level, hud.score));
    } else if (hud.level > previous.level) {
      announce(messages.levelStart(hud.level));
    } else if (hud.bossMaxHealth > 0 && previous.bossMaxHealth === 0) {
      announce(messages.bossArrived);
    } else if (hud.bossEnraged && !previous.bossEnraged) {
      announce(messages.bossEnraged);
    } else if (hud.bossMaxHealth > 0 && hud.bossHealth === 0 && previous.bossHealth > 0) {
      announce(messages.bossDefeated(hud.bossMaxHealth));
    } else if (hud.lives < previous.lives) {
      announce(messages.lifeLost(hud.lives));
    } else if (hud.lives > previous.lives) {
      announce(messages.lifeGained(hud.lives));
    } else if (hud.shield > previous.shield) {
      // The seconds only go down while it lasts, so more means a shield was just collected.
      announce(messages.shieldOn(hud.shield));
    } else if (hud.rapidFire > previous.rapidFire) {
      announce(messages.rapidFireOn(hud.rapidFire));
    }
    previous = hud;
  });
}
