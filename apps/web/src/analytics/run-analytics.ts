import type { GameEventSource } from '@buzzkill/game';

import type { Analytics } from './analytics';

interface RunAnalyticsOptions {
  /** Whether the run plays at a slower game speed (ADR-0014). */
  readonly slower: boolean;
  readonly track: Analytics['track'];
}

/**
 * Counts what happens in one run (ADR-0019): each level reached after the first, the queen
 * defeated, and a lost run as a death, with its level and what struck the hero last. It listens
 * to the game's events, which fire on these moments only, never per frame; the start of a run and
 * a replay are counted by the shell, which sees them.
 */
export function followRunAnalytics(
  events: GameEventSource,
  { slower, track }: RunAnalyticsOptions,
): void {
  let level = 1;
  let cause = 'unknown';
  events.on('levelStarted', (started) => {
    level = started.level;
    if (level > 1) {
      track('level_reached', { level, slower });
    }
  });
  events.on('playerHit', (hit) => {
    cause = hit.cause;
  });
  events.on('bossDefeated', () => {
    track('boss_defeated', { slower });
  });
  events.on('gameOver', ({ result }) => {
    if (result === 'lost') {
      track('death', { level, cause, slower });
    }
  });
}
