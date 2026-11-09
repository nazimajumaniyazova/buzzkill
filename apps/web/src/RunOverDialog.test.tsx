import type { RunResult } from '@buzzkill/game';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { RunOverDialog } from './RunOverDialog';

const result: RunResult = {
  score: 42,
  level: 1,
  ticks: 600,
  livesLeft: 0,
  status: 'lost',
  hash: '0badf00d',
};

describe('RunOverDialog', () => {
  it('is a modal dialog with the title it is given and the score, Play again focused', async () => {
    const { baseElement } = render(
      <RunOverDialog title="Game over" result={result} onPlayAgain={vi.fn()} onQuit={vi.fn()} />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Game over' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Score: 42');
    expect(within(dialog).getByRole('button', { name: 'Play again' })).toHaveFocus();
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it('plays again, or goes back to the menu by the button, by Escape and by the close button', () => {
    const onPlayAgain = vi.fn();
    const onQuit = vi.fn();
    render(
      <RunOverDialog
        title="Level complete"
        result={{ ...result, status: 'won' }}
        onPlayAgain={onPlayAgain}
        onQuit={onQuit}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Level complete' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to menu' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onPlayAgain).toHaveBeenCalledOnce();
    expect(onQuit).toHaveBeenCalledTimes(3);
  });
});
