// @vitest-environment node
import { createEventBus } from '@buzzkill/engine';
import type { GameEvents } from '@buzzkill/game';
import { describe, expect, it, vi } from 'vitest';

import { followRunAnalytics } from './run-analytics';

function follow(slower = false) {
  const events = createEventBus<GameEvents>();
  const track = vi.fn();
  followRunAnalytics(events, { slower, track });
  return { events, track };
}

describe('followRunAnalytics', () => {
  it('counts each level reached after the first, and the queen defeated', () => {
    const { events, track } = follow();

    events.emit('levelStarted', { level: 1, mode: 'day' });
    events.emit('levelCleared', { level: 1, score: 100 });
    events.emit('levelStarted', { level: 2, mode: 'day' });
    events.emit('bossDefeated', { x: 1, y: 2, value: 60 });

    expect(track.mock.calls).toEqual([
      ['level_reached', { level: 2, slower: false }],
      ['boss_defeated', { slower: false }],
    ]);
  });

  it('counts a lost run as a death, with its level and what struck the hero last', () => {
    const { events, track } = follow(true);

    events.emit('levelStarted', { level: 1, mode: 'day' });
    events.emit('levelStarted', { level: 3, mode: 'night' });
    events.emit('playerHit', { livesLeft: 2, cause: 'night-bat' });
    events.emit('playerHit', { livesLeft: 1, cause: 'sting' });
    events.emit('playerHit', { livesLeft: 0, cause: 'charge' });
    events.emit('gameOver', { result: 'lost', score: 900 });

    expect(track).toHaveBeenLastCalledWith('death', { level: 3, cause: 'charge', slower: true });
  });

  it('counts no death for a run that was won', () => {
    const { events, track } = follow();

    events.emit('playerHit', { livesLeft: 2, cause: 'day-1' });
    events.emit('gameOver', { result: 'won', score: 5000 });

    expect(track).not.toHaveBeenCalled();
  });
});
