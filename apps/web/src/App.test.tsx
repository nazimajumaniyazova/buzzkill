import type { AssetFailure } from '@buzzkill/engine';
import type { RunResult } from '@buzzkill/game';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { App } from './App';
import type { BootEvent } from './BootScreen';
import type { GameEvent } from './state/bridge';
import { createAppStore, type GameAssets, type Run } from './state/machine';

const unlock = vi.fn(() => Promise.resolve());
// The shell calls only unlock; the game view, which uses the rest, is replaced below.
const assets = { sprites: {}, audio: { unlock } } as unknown as GameAssets;

const failure: AssetFailure = {
  id: 'projectile',
  kind: 'image',
  url: '/projectile.png',
  reason: 'http',
  message: 'HTTP 404',
};

function resultWith(status: RunResult['status']): RunResult {
  return { score: 42, level: 1, ticks: 600, livesLeft: 0, status, hash: '0badf00d' };
}

// The boot and the game view are the two components with effects of their own; here they are
// buttons that report what the real ones would.
vi.mock('./BootScreen', () => ({
  BootScreen: ({
    attempt,
    failures,
    onEvent,
    onRetry,
  }: {
    attempt: number;
    failures: readonly AssetFailure[] | null;
    onEvent: (event: BootEvent) => void;
    onRetry: () => void;
  }) => (
    <div>
      <p>
        Boot attempt {attempt},{' '}
        {failures === null ? 'loading' : `${String(failures.length)} failed`}
      </p>
      <button
        type="button"
        onClick={() => {
          onEvent({ type: 'booted', assets });
        }}
      >
        Finish boot
      </button>
      <button
        type="button"
        onClick={() => {
          onEvent({ type: 'bootFailed', failures: [failure] });
        }}
      >
        Fail boot
      </button>
      <button type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  ),
}));

vi.mock('./GameView', () => ({
  GameView: ({
    run,
    paused,
    onEvent,
  }: {
    run: Run;
    paused: boolean;
    onEvent: (event: GameEvent) => void;
  }) => (
    <div>
      <p>
        Game view: {run.heroId} {run.mode} seed {run.seed} volume {run.volume}
        {paused ? ', held' : ''}
      </p>
      <button
        type="button"
        onClick={() => {
          onEvent({ type: 'gamePaused' });
        }}
      >
        Game pauses itself
      </button>
      <button
        type="button"
        onClick={() => {
          onEvent({ type: 'runEnded', result: resultWith('lost') });
        }}
      >
        Lose
      </button>
      <button
        type="button"
        onClick={() => {
          onEvent({ type: 'runEnded', result: resultWith('won') });
        }}
      >
        Win
      </button>
    </div>
  ),
}));

const click = (name: string): void => {
  fireEvent.click(screen.getByRole('button', { name }));
};

/** Boots and starts a run with the defaults: Mike, day, 30 %. */
function startRun(): void {
  click('Finish boot');
  click('Play');
  click('Start');
}

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    unlock.mockClear();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    window.history.replaceState(null, '', '/');
  });

  it('boots first, then shows the menu, and passes the accessibility check', async () => {
    const { container } = render(<App />);

    expect(screen.getByText('Boot attempt 0, loading')).toBeInTheDocument();

    click('Finish boot');

    expect(screen.getByRole('heading', { level: 1, name: 'Buzzkill' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows the failures of a boot and loads again on retry', () => {
    render(<App />);

    click('Fail boot');
    expect(screen.getByText('Boot attempt 0, 1 failed')).toBeInTheDocument();

    click('Try again');
    expect(screen.getByText('Boot attempt 1, loading')).toBeInTheDocument();
  });

  it('goes from the menu to the hero select and back', () => {
    render(<App />);
    click('Finish boot');

    click('Play');
    expect(screen.getByRole('heading', { level: 1, name: 'Choose your hero' })).toBeInTheDocument();

    click('Back');
    expect(screen.getByRole('heading', { level: 1, name: 'Buzzkill' })).toBeInTheDocument();
  });

  it('starts the chosen run with the seed of the URL and starts the audio in the click', () => {
    window.history.replaceState(null, '', '/?seed=7');
    render(<App />);
    click('Finish boot');
    click('Play');

    fireEvent.click(screen.getByRole('radio', { name: 'Julie' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Night' }));
    click('Start');

    expect(screen.getByText('Game view: female night seed 7 volume 0.3')).toBeInTheDocument();
    expect(unlock).toHaveBeenCalledOnce();
  });

  it("pauses on the game's report, resumes by button or pause key, and quits to the menu", async () => {
    const { container } = render(<App />);
    startRun();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    click('Game pauses itself');
    const dialog = screen.getByRole('dialog', { name: 'Paused' });
    expect(within(dialog).getByRole('button', { name: 'Resume' })).toHaveFocus();
    expect(screen.getByText(/, held$/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    click('Resume');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText(/, held$/)).not.toBeInTheDocument();

    click('Game pauses itself');
    fireEvent.keyDown(window, { code: 'KeyA' });
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument();
    fireEvent.keyDown(window, { code: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    click('Game pauses itself');
    click('Quit to menu');
    expect(screen.getByRole('heading', { level: 1, name: 'Buzzkill' })).toBeInTheDocument();
  });

  it('ends a lost run as game over and a won run as level complete, over the running view', async () => {
    window.history.replaceState(null, '', '/?seed=7');
    const { container } = render(<App />);
    startRun();

    click('Lose');
    expect(screen.getByRole('dialog', { name: 'Game over' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Score: 42');
    expect(screen.getByText('Game view: male day seed 7 volume 0.3')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    click('Play again');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(unlock).toHaveBeenCalledTimes(2);

    click('Win');
    expect(screen.getByRole('dialog', { name: 'Level complete' })).toBeInTheDocument();

    click('Back to menu');
    expect(screen.getByRole('heading', { level: 1, name: 'Buzzkill' })).toBeInTheDocument();
  });

  it('follows the system theme until the player picks one, then remembers the pick', () => {
    render(<App />);
    click('Finish boot');

    expect(document.documentElement).not.toHaveAttribute('data-theme');

    fireEvent.click(screen.getByRole('radio', { name: 'Always night' }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'night');
    expect(screen.getByRole('radio', { name: 'Always night' })).toBeChecked();
    expect(localStorage.getItem('buzzkill.theme')).toBe('night');
  });

  it("restores the stored theme and uses the run's time of day while a run is on screen", () => {
    localStorage.setItem('buzzkill.theme', 'night');
    render(<App />);
    click('Finish boot');

    expect(document.documentElement).toHaveAttribute('data-theme', 'night');
    expect(screen.getByRole('radio', { name: 'Always night' })).toBeChecked();

    click('Play');
    click('Start');
    expect(document.documentElement).toHaveAttribute('data-theme', 'day');

    click('Lose');
    expect(document.documentElement).toHaveAttribute('data-theme', 'day');

    click('Back to menu');
    expect(document.documentElement).toHaveAttribute('data-theme', 'night');
  });

  it('renders the state of the store it is given', () => {
    const run: Run = { heroId: 'female', mode: 'night', volume: 1, seed: 3 };
    render(<App store={createAppStore({ name: 'paused', assets, run })} />);

    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument();
    expect(screen.getByText('Game view: female night seed 3 volume 1, held')).toBeInTheDocument();
  });
});
