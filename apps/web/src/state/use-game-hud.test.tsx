import type { Game, GameHud } from '@buzzkill/game';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useGameHud } from './use-game-hud';

/** A game whose HUD the test publishes by hand, as `createGame` does once per frame. */
function createFakeGame() {
  let hud: GameHud = { score: 0, lives: 5, ammo: 20, status: 'playing', paused: false };
  const listeners = new Set<(hud: GameHud) => void>();
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
    getHud: () => hud,
    replay: vi.fn(),
    result: vi.fn(),
  };
  const publish = (change: Partial<GameHud>): void => {
    hud = { ...hud, ...change };
    act(() => {
      for (const listener of listeners) {
        listener(hud);
      }
    });
  };
  return { game, publish, listeners };
}

const score = (hud: GameHud): number => hud.score;

describe('useGameHud', () => {
  it('returns the selected value and follows its changes', () => {
    const { game, publish } = createFakeGame();
    const { result } = renderHook(() => useGameHud(game, score));

    expect(result.current).toBe(0);

    publish({ score: 7 });

    expect(result.current).toBe(7);
  });

  it('renders again only when the selected value changes', () => {
    const { game, publish } = createFakeGame();
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useGameHud(game, score);
    });

    publish({ ammo: 19 });
    publish({ lives: 4, paused: true });
    // A new HUD object with the same score.
    publish({});
    expect(renders).toBe(1);

    publish({ score: 1 });
    expect(renders).toBe(2);
  });

  it('compares a derived value by what it is, not by the object it came from', () => {
    const { game, publish } = createFakeGame();
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useGameHud(game, (hud) => `${String(hud.lives)} of 5`);
    });

    publish({ score: 3 });
    expect(renders).toBe(1);

    publish({ lives: 4 });
    expect(result.current).toBe('4 of 5');
    expect(renders).toBe(2);
  });

  it('subscribes once, follows a new game and unsubscribes on unmount', () => {
    const first = createFakeGame();
    const second = createFakeGame();
    const { result, rerender, unmount } = renderHook(({ game }) => useGameHud(game, score), {
      initialProps: { game: first.game },
    });
    rerender({ game: first.game });
    expect(first.listeners.size).toBe(1);

    second.publish({ score: 9 });
    rerender({ game: second.game });

    expect(result.current).toBe(9);
    expect(first.listeners.size).toBe(0);
    expect(second.listeners.size).toBe(1);

    unmount();
    expect(second.listeners.size).toBe(0);
  });
});
