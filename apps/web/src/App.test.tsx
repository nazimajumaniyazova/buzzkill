import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { App } from './App';

vi.mock('./GameSession', () => ({
  GameSession: ({
    choice,
    audioContext,
    onExit,
  }: {
    choice: { heroId: string; mode: string };
    audioContext: unknown;
    onExit: () => void;
  }) => (
    <div>
      <p>
        Session: {choice.heroId} {choice.mode}, audio {audioContext === null ? 'off' : 'on'}
      </p>
      <button type="button" onClick={onExit}>
        Exit
      </button>
    </div>
  ),
}));

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the start screen first and passes the accessibility check', async () => {
    const { container } = render(<App />);

    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('starts audio in the Play click and opens a game session', () => {
    const resume = vi.fn(() => Promise.resolve());
    const constructed = vi.fn();
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          constructed();
        }
        resume = resume;
      },
    );
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(resume).toHaveBeenCalledOnce();
    expect(screen.getByText('Session: male day, audio on')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Exit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    // One context for the page, reused by the next session.
    expect(constructed).toHaveBeenCalledOnce();
    expect(resume).toHaveBeenCalledTimes(2);
  });

  it('plays without sound where Web Audio is missing', () => {
    vi.stubGlobal('AudioContext', undefined);
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(screen.getByText('Session: male day, audio off')).toBeInTheDocument();
  });
});
