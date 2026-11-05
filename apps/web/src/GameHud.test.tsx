import type { Game, GameHud as Hud } from '@buzzkill/game';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { GameHud } from './GameHud';

/** A game whose HUD the test sets by hand. */
function createFakeGame() {
  let hud: Hud = { score: 0, lives: 5, ammo: 20, status: 'playing', paused: false };
  const listeners = new Set<(hud: Hud) => void>();
  const game = {
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(() => {
      update({ paused: false });
    }),
    dispose: vi.fn(),
    subscribe: vi.fn((listener: (hud: Hud) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    getHud: () => hud,
    replay: vi.fn(),
    result: vi.fn(),
  } satisfies Game;
  function update(change: Partial<Hud>): void {
    hud = { ...hud, ...change };
    act(() => {
      for (const listener of listeners) {
        listener(hud);
      }
    });
  }
  return { game, update };
}

function setup() {
  const fake = createFakeGame();
  const onPlayAgain = vi.fn();
  const onExit = vi.fn();
  const view = render(<GameHud game={fake.game} onPlayAgain={onPlayAgain} onExit={onExit} />);
  /** Score, lives and ammo as shown. */
  const values = () =>
    within(screen.getByRole('region', { name: 'Game status' }))
      .getAllByRole('definition')
      .map((value) => value.textContent);
  return { ...fake, onPlayAgain, onExit, values, ...view };
}

describe('GameHud', () => {
  it('shows score, lives and ammo and passes the accessibility check', async () => {
    const { values, container } = setup();

    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Score',
      'Lives',
      'Ammo',
    ]);
    expect(values()).toEqual(['0', '5 of 5', '20']);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders the values the game publishes', () => {
    const { update, values } = setup();

    update({ score: 7, ammo: 12, lives: 3 });

    expect(values()).toEqual(['7', '3 of 5', '12']);
  });

  it('shows a pause dialog that resumes by button or by the pause key', () => {
    const { game, update } = setup();

    update({ paused: true });
    const dialog = screen.getByRole('dialog', { name: 'Paused' });
    expect(within(dialog).getByRole('button', { name: 'Resume' })).toHaveFocus();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Resume' }));
    expect(game.resume).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    update({ paused: true });
    fireEvent.keyDown(window, { code: 'KeyA' });
    expect(game.resume).toHaveBeenCalledOnce();
    fireEvent.keyDown(window, { code: 'Escape' });
    expect(game.resume).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(window, { code: 'Escape' });
    expect(game.resume).toHaveBeenCalledTimes(2);
  });

  it('quits to the menu from the pause dialog', () => {
    const { update, onExit } = setup();
    update({ paused: true });

    fireEvent.click(screen.getByRole('button', { name: 'Quit to menu' }));

    expect(onExit).toHaveBeenCalledOnce();
  });

  it('announces the end of the run and offers to play again or go back', async () => {
    const { update, onPlayAgain, onExit, container } = setup();

    update({ status: 'lost', score: 42 });
    expect(screen.getByRole('dialog', { name: 'Game over' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Score: 42');
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to menu' }));
    expect(onPlayAgain).toHaveBeenCalledOnce();
    expect(onExit).toHaveBeenCalledOnce();

    update({ status: 'won' });
    expect(screen.getByRole('dialog', { name: 'You won!' })).toBeInTheDocument();
  });
});
