import { createEventBus } from '@buzzkill/engine';
import { describe, expect, it } from 'vitest';

import type { GameMode } from '../config/enemies';
import type { GameEvents } from '../simulation/state';
import type { EntityId } from '../world/world';
import {
  ACHIEVEMENT_SCORE,
  type AchievementId,
  type AchievementProgress,
  ACHIEVEMENTS,
  followAchievements,
  noProgress,
  unlocked,
} from './achievements';

/** A test id; the conditions never read it. */
// The world brands its ids; any number is one here.
const ENEMY = 1 as EntityId;

const destroyed = { x: 0, y: 0, value: 1 } as const;

/**
 * A run that starts at `mode` with `progress`, followed by the achievements. `emit` sends events,
 * `progress` is the latest progress and `earned` every achievement unlocked so far, in order.
 */
function run(mode: GameMode = 'day', progress: AchievementProgress = noProgress()) {
  const events = createEventBus<GameEvents>();
  const state = { progress, earned: [] as AchievementId[] };
  followAchievements(events, {
    mode,
    progress,
    onChange(next, newly) {
      state.progress = next;
      state.earned.push(...newly);
    },
  });
  return {
    emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void {
      events.emit(type, payload);
    },
    get progress() {
      return state.progress;
    },
    get earned() {
      return state.earned;
    },
  };
}

/** Sends `count` destroyed insects. */
function destroy(game: ReturnType<typeof run>, count: number): void {
  for (let i = 0; i < count; i += 1) {
    game.emit('enemyDestroyed', destroyed);
  }
}

const goal = (id: AchievementId): number =>
  ACHIEVEMENTS.find((achievement) => achievement.id === id)?.goal ?? Number.NaN;

describe('ACHIEVEMENTS', () => {
  it('has unique ids and a goal of at least one for each', () => {
    const ids = ACHIEVEMENTS.map(({ id }) => id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const { goal: target } of ACHIEVEMENTS) {
      expect(Number.isInteger(target) && target >= 1).toBe(true);
    }
  });
});

describe('followAchievements', () => {
  it('earns the first swat with the first insect destroyed, once', () => {
    const game = run();

    destroy(game, 2);

    expect(game.earned).toEqual(['firstSwat']);
    expect(game.progress.firstSwat).toBe(1);
  });

  it('counts the insects of every run toward the swatter, and keeps the count at its goal', () => {
    const before = { ...noProgress(), swatter: goal('swatter') - 2 };
    const game = run('day', before);

    destroy(game, 5);

    expect(game.earned).toContain('swatter');
    expect(game.progress.swatter).toBe(goal('swatter'));
  });

  it('counts only the insects destroyed at night toward the night shift', () => {
    const game = run('day');
    destroy(game, 3);
    expect(game.progress.nightShift).toBe(0);

    game.emit('levelStarted', { level: 4, mode: 'night' });
    destroy(game, 3);

    expect(game.progress.nightShift).toBe(3);
    expect(run('night', game.progress).progress.nightShift).toBe(3);
  });

  it('earns untouched for a level cleared without a life lost in it, not before', () => {
    const game = run();
    game.emit('playerHit', { livesLeft: 2 });
    game.emit('levelCleared', { level: 1, score: 10 });
    expect(game.progress.untouched).toBe(0);

    game.emit('levelStarted', { level: 2, mode: 'day' });
    game.emit('levelCleared', { level: 2, score: 20 });

    expect(game.earned).toContain('untouched');
  });

  it('counts the power-ups collected toward the collector', () => {
    const game = run();

    game.emit('powerUpCollected', { kind: 'ammo', x: 0, y: 0 });
    game.emit('powerUpCollected', { kind: 'life', x: 0, y: 0 });

    expect(game.progress.collector).toBe(2);
    expect(goal('collector')).toBeGreaterThan(2);
  });

  it('earns regicide when the queen falls', () => {
    const game = run();
    game.emit('bossHit', { healthLeft: 3, x: 0, y: 0 });
    expect(game.earned).toEqual([]);

    game.emit('bossDefeated', { x: 0, y: 0, value: 60 });

    expect(game.earned).toEqual(['regicide']);
  });

  it('earns the champion for a won run only', () => {
    const lost = run();
    lost.emit('gameOver', { result: 'lost', score: 400 });
    const won = run();
    won.emit('gameOver', { result: 'won', score: 100 });

    expect(lost.earned).not.toContain('champion');
    expect(won.earned).toContain('champion');
  });

  it('earns flawless for a run won without a life lost in it', () => {
    const scarred = run();
    scarred.emit('playerHit', { livesLeft: 4 });
    scarred.emit('levelStarted', { level: 2, mode: 'day' });
    scarred.emit('gameOver', { result: 'won', score: 300 });
    const clean = run();
    clean.emit('gameOver', { result: 'won', score: 300 });

    expect(scarred.earned).not.toContain('flawless');
    expect(clean.earned).toContain('flawless');
  });

  it('earns the high score for a run that ends at or above it, won or lost', () => {
    const short = run();
    short.emit('gameOver', { result: 'lost', score: ACHIEVEMENT_SCORE - 1 });
    const long = run();
    long.emit('gameOver', { result: 'lost', score: ACHIEVEMENT_SCORE });

    expect(short.earned).not.toContain('highScore');
    expect(long.earned).toContain('highScore');
  });

  it('reports nothing for events that move no achievement, and never earns one twice', () => {
    const game = run();
    game.emit('enemyHit', { id: ENEMY, healthLeft: 1, x: 0, y: 0 });
    game.emit('shot', { x: 0, y: 0 });
    expect(game.earned).toEqual([]);

    game.emit('bossDefeated', { x: 0, y: 0, value: 60 });
    game.emit('bossDefeated', { x: 0, y: 0, value: 60 });

    expect(game.earned).toEqual(['regicide']);
  });
});

describe('unlocked', () => {
  it('lists the achievements whose goal the progress has reached, in the order of the data', () => {
    const progress = { ...noProgress(), regicide: 1, firstSwat: 1, swatter: 3 };

    expect(unlocked(progress)).toEqual(['firstSwat', 'regicide']);
  });
});
