import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { PauseDialog } from './PauseDialog';

describe('PauseDialog', () => {
  it('is a modal dialog named Paused with Resume focused, and passes the accessibility check', async () => {
    const { baseElement } = render(<PauseDialog onResume={vi.fn()} onQuit={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'Paused' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('The run waits for you.');
    expect(within(dialog).getByRole('button', { name: 'Resume' })).toHaveFocus();
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it('resumes by the button, by Escape and by the close button', () => {
    const onResume = vi.fn();
    const onQuit = vi.fn();
    render(<PauseDialog onResume={onResume} onQuit={onQuit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onResume).toHaveBeenCalledTimes(3);
    expect(onQuit).not.toHaveBeenCalled();
  });

  it('quits to the menu', () => {
    const onQuit = vi.fn();
    render(<PauseDialog onResume={vi.fn()} onQuit={onQuit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Quit to menu' }));

    expect(onQuit).toHaveBeenCalledOnce();
  });
});
