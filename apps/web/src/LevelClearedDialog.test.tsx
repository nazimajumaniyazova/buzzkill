import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { LevelClearedDialog } from './LevelClearedDialog';

describe('LevelClearedDialog', () => {
  it('names the cleared level, says the score, and has Next level focused', async () => {
    const { baseElement } = render(
      <LevelClearedDialog
        level={1}
        score={42}
        time="day"
        nextTime="day"
        onNext={vi.fn()}
        onQuit={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Level 1 cleared' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Score: 42.');
    expect(within(dialog).getByRole('button', { name: 'Next level' })).toHaveFocus();
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it('says when night falls or day breaks before the next level', () => {
    const { rerender } = render(
      <LevelClearedDialog
        level={3}
        score={120}
        time="day"
        nextTime="night"
        onNext={vi.fn()}
        onQuit={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
      'Score: 120. Night falls over the city.',
    );

    rerender(
      <LevelClearedDialog
        level={3}
        score={120}
        time="night"
        nextTime="day"
        onNext={vi.fn()}
        onQuit={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
      'Score: 120. Day breaks over the city.',
    );
  });

  it('goes on by the button, by Escape and by the close button, or quits to the menu', () => {
    const onNext = vi.fn();
    const onQuit = vi.fn();
    render(
      <LevelClearedDialog
        level={2}
        score={80}
        time="night"
        nextTime="night"
        onNext={onNext}
        onQuit={onQuit}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next level' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onNext).toHaveBeenCalledTimes(3);
    expect(onQuit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Quit to menu' }));
    expect(onQuit).toHaveBeenCalledOnce();
  });
});
