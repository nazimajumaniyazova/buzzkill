import { fireEvent, render, screen } from '@testing-library/react';
import { type JSX, useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { reportError } from './errors/report-error';
import { Root } from './Root';

const shell = vi.hoisted(() => ({
  /** When true, the next shell to render throws. */
  broken: false,
  /** How many shells have mounted. */
  mounts: 0,
}));

vi.mock('./errors/report-error', () => ({ reportError: vi.fn() }));

// The shell itself, replaced: it throws while `broken` says so, and counts its mounts.
vi.mock('./App', () => ({
  App: function FakeApp(): JSX.Element {
    // A render that throws never commits, so its effect never runs.
    useEffect(() => {
      shell.mounts += 1;
    }, []);
    if (shell.broken) {
      throw new Error('The shell broke');
    }
    return <h1>Main menu</h1>;
  },
}));

/** The root of main.tsx leaves caught errors to the boundaries. */
const options = { onCaughtError: () => undefined };

describe('Root', () => {
  afterEach(() => {
    shell.broken = false;
    shell.mounts = 0;
    vi.mocked(reportError).mockClear();
    document.documentElement.removeAttribute('lang');
  });

  it('renders the shell', () => {
    render(<Root />, options);

    expect(screen.getByRole('heading', { name: 'Main menu' })).toBeInTheDocument();
    expect(reportError).not.toHaveBeenCalled();
  });

  it('shows the error screen of the shell when it throws, reports it, and passes axe', async () => {
    shell.broken = true;
    const { container } = render(<Root />, options);

    expect(screen.getByRole('alert')).toHaveTextContent('Buzzkill stopped on an error');
    expect(reportError).toHaveBeenCalledExactlyOnceWith(new Error('The shell broke'), {
      source: 'shell',
      componentStack: expect.stringContaining('FakeApp') as unknown,
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('mounts a new shell on Restart', () => {
    shell.broken = true;
    render(<Root />, options);
    shell.broken = false;

    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));

    expect(screen.getByRole('heading', { name: 'Main menu' })).toBeInTheDocument();
    expect(shell.mounts).toBe(1);
  });

  it("speaks the page's language, which the shell kept in step with the settings", () => {
    document.documentElement.lang = 'ru';
    shell.broken = true;
    render(<Root />, options);

    expect(screen.getByRole('button', { name: 'Начать заново' })).toHaveFocus();
  });
});
