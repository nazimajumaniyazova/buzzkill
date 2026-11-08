import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, type JSX, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { Button } from '../Button/Button';
import { Dialog } from './Dialog';

/** A page with an opener, as the shell will use it. */
function Page({ onClose = (): void => undefined }: { onClose?: () => void }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        Pause
      </Button>
      <Dialog
        open={open}
        title="Paused"
        description="The run waits for you."
        onClose={() => {
          onClose();
          setOpen(false);
        }}
      >
        <Button
          onClick={() => {
            setOpen(false);
          }}
        >
          Resume
        </Button>
        <Button variant="secondary">Quit to menu</Button>
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('renders nothing while closed', () => {
    render(
      <Dialog open={false} title="Paused" onClose={vi.fn()}>
        Content
      </Dialog>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('follows the dialog pattern: modal, labelled by its title, described by its text', () => {
    render(
      <Dialog open title="Paused" description="The run waits for you." onClose={vi.fn()}>
        <p>Content</p>
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Paused' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAccessibleDescription('The run waits for you.');
    expect(screen.getByRole('heading', { level: 2, name: 'Paused' })).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('moves focus to the first control on open and back to the opener on close', async () => {
    const user = userEvent.setup();
    render(<Page />);

    await user.click(screen.getByRole('button', { name: 'Pause' }));

    expect(screen.getByRole('button', { name: 'Resume' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Resume' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toHaveFocus();
  });

  it('focuses the element the caller names, or the dialog itself when nothing is focusable', () => {
    const ref = createRef<HTMLButtonElement>();
    const { unmount } = render(
      <Dialog open title="Game over" onClose={vi.fn()} initialFocusRef={ref}>
        <Button>Play again</Button>
        <Button ref={ref} variant="secondary">
          Back to menu
        </Button>
      </Dialog>,
    );

    expect(screen.getByRole('button', { name: 'Back to menu' })).toHaveFocus();
    unmount();

    render(
      <Dialog open title="Notice" onClose={vi.fn()} closeLabel="Dismiss">
        <p>Text only</p>
      </Dialog>,
    );

    // The close button is focusable, so it is the first control when the body has none.
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveFocus();
  });

  it('asks to close on Escape and on the close button, once each', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Page onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Pause' }));
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pause' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <Dialog open title="Paused" description="The run waits for you." onClose={vi.fn()}>
        <Button>Resume</Button>
      </Dialog>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
