// @vitest-environment node
import type { Game, GameHud, RunResult } from '@buzzkill/game';
import { describe, expect, it, vi } from 'vitest';

import { connectGame } from './bridge';

/** A game whose HUD the test publishes by hand, as `createGame` does once per frame. */
function createFakeGame() {
  let hud: GameHud = {
    score: 0,
    lives: 5,
    ammo: 20,
    level: 1,
    mode: 'day',
    status: 'playing',
    paused: false,
  };
  const listeners = new Set<(hud: GameHud) => void>();
  const result = (): RunResult => ({
    score: hud.score,
    level: 1,
    ticks: 100,
    livesLeft: hud.lives,
    status: hud.status,
    hash: '0badf00d',
  });
  const game: Game = {
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    dispose: vi.fn(),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    nextLevel: vi.fn(),
    getHud: () => hud,
    replay: vi.fn(),
    result,
  };
  const publish = (change: Partial<GameHud>): void => {
    hud = { ...hud, ...change };
    for (const listener of listeners) {
      listener(hud);
    }
  };
  return { game, publish, listeners };
}

describe('connectGame', () => {
  it('turns a pause and a resume of the game into events', () => {
    const { game, publish } = createFakeGame();
    const send = vi.fn();
    connectGame(game, send);

    publish({ paused: true });
    publish({ paused: false });

    expect(send.mock.calls).toEqual([[{ type: 'gamePaused' }], [{ type: 'gameResumed' }]]);
  });

  it('reports a cleared level once, with the time of day of the next one, not as the end', () => {
    const { game, publish } = createFakeGame();
    const send = vi.fn();
    connectGame(game, send);

    // The third level ends with the sunset (ADR-0017).
    publish({ status: 'levelCleared', level: 3, score: 120 });
    publish({ status: 'playing', level: 4, mode: 'night' });

    expect(send.mock.calls).toEqual([
      [{ type: 'levelCleared', level: 3, score: 120, nextTime: 'night' }],
    ]);
  });

  it('reports the end of the run once, with the result of the game', () => {
    const { game, publish } = createFakeGame();
    const send = vi.fn();
    connectGame(game, send);

    publish({ status: 'lost', lives: 0, score: 7 });
    // The world moves on for the picture after the end, and the HUD may still change.
    publish({ score: 7, ammo: 3 });

    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'runEnded',
      result: { score: 7, level: 1, ticks: 100, livesLeft: 0, status: 'lost', hash: '0badf00d' },
    });
  });

  it('reports a win the same way', () => {
    const { game, publish } = createFakeGame();
    const send = vi.fn();
    connectGame(game, send);

    publish({ status: 'won', score: 100 });

    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'runEnded',
      result: { score: 100, level: 1, ticks: 100, livesLeft: 5, status: 'won', hash: '0badf00d' },
    });
  });

  it('ignores changes of score, lives and ammo: those belong to the HUD store', () => {
    const { game, publish } = createFakeGame();
    const send = vi.fn();
    connectGame(game, send);

    publish({ score: 10 });
    publish({ lives: 4, ammo: 12 });

    expect(send).not.toHaveBeenCalled();
  });

  it('stops listening when disconnected', () => {
    const { game, publish, listeners } = createFakeGame();
    const send = vi.fn();
    const disconnect = connectGame(game, send);

    disconnect();
    publish({ paused: true });

    expect(send).not.toHaveBeenCalled();
    expect(listeners.size).toBe(0);
  });
});
