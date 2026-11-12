// @vitest-environment node
import type { Game, GameHud, RunResult } from '@buzzkill/game';
import { describe, expect, it, vi } from 'vitest';

import { en } from '../i18n/en';
import { createFormat } from '../i18n/format';
import { ru } from '../i18n/ru';
import { announceRun } from './announce-run';

const messages = en(createFormat('en')).announce;

/** A game whose HUD the test pushes, as the real one does after a tick. */
function createPushedGame() {
  let hud: GameHud = {
    score: 0,
    lives: 5,
    ammo: 20,
    level: 1,
    mode: 'day',
    status: 'playing',
    paused: false,
  };
  const listeners = new Set<(next: GameHud) => void>();
  const game = {
    getHud: () => hud,
    subscribe: (listener: (next: GameHud) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    result: () => ({ level: 1 }) as RunResult,
  } as unknown as Game;
  const push = (changes: Partial<GameHud>): void => {
    hud = { ...hud, ...changes };
    for (const listener of listeners) {
      listener(hud);
    }
  };
  return { game, push, listening: () => listeners.size };
}

describe('announceRun', () => {
  it('says the level when the run starts', () => {
    const { game } = createPushedGame();
    const announce = vi.fn();

    announceRun(game, announce, messages);

    expect(announce.mock.calls).toEqual([['Level 1. Go!']]);
  });

  it('says each new level when it starts, politely', () => {
    const { game, push } = createPushedGame();
    const announce = vi.fn();
    announceRun(game, announce, messages);
    announce.mockClear();

    push({ status: 'levelCleared', score: 12 });
    push({ status: 'playing', level: 2 });

    expect(announce).toHaveBeenCalledExactlyOnceWith(messages.levelStart(2));
  });

  it('says each life lost and how many are left, politely', () => {
    const { game, push } = createPushedGame();
    const announce = vi.fn();
    announceRun(game, announce, messages);
    announce.mockClear();

    push({ score: 30 });
    push({ lives: 4 });
    push({ ammo: 19 });
    push({ lives: 1 });

    expect(announce.mock.calls).toEqual([['Hit! 4 lives left.'], ['Hit! 1 life left.']]);
  });

  it('says game over at once, once, with the score, instead of the last life', () => {
    const { game, push } = createPushedGame();
    const announce = vi.fn();
    announceRun(game, announce, messages);
    announce.mockClear();

    push({ lives: 0, status: 'lost', score: 1234 });
    push({ paused: true });

    expect(announce.mock.calls).toEqual([['Game over. Score: 1,234.', 'assertive']]);
  });

  it('says a level complete politely', () => {
    const { game, push } = createPushedGame();
    const announce = vi.fn();
    announceRun(game, announce, messages);
    announce.mockClear();

    push({ status: 'won', score: 900 });

    expect(announce.mock.calls).toEqual([['Level complete. Score: 900.']]);
  });

  it('stops listening when asked', () => {
    const { game, listening } = createPushedGame();

    const stop = announceRun(game, vi.fn(), messages);
    expect(listening()).toBe(1);
    stop();

    expect(listening()).toBe(0);
  });

  it('speaks Russian with the right form of the word for lives', () => {
    const russian = ru(createFormat('ru')).announce;

    expect(russian.levelStart(1)).toBe('Уровень 1. Вперёд!');
    expect([1, 2, 5, 21].map((lives) => russian.lifeLost(lives))).toEqual([
      'Попадание! Осталась 1 жизнь.',
      'Попадание! Осталось 2 жизни.',
      'Попадание! Осталось 5 жизней.',
      'Попадание! Осталась 21 жизнь.',
    ]);
    expect(russian.gameOver(1234)).toBe('Игра окончена. Счёт: 1 234.');
  });
});
