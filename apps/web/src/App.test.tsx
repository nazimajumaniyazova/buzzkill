import type { AssetFailure } from '@buzzkill/engine';
import type { GamepadLike } from '@buzzkill/engine/browser';
import type { RunResult } from '@buzzkill/game';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { App } from './App';
import type { BootEvent } from './BootScreen';
import type { GameEvent } from './state/bridge';
import { createAppStore, type GameAssets, type Run } from './state/machine';
import { DEFAULT_SETTINGS } from './state/settings/schema';
import { createSettingsStore } from './state/settings/store';

const unlock = vi.fn(() => Promise.resolve());
const setVolume = vi.fn();
// The shell calls unlock and setVolume; the game view, which uses the rest, is replaced below.
const assets = { sprites: {}, audio: { unlock, setVolume } } as unknown as GameAssets;

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
    <main aria-label="Game">
      <p>
        Game view: {run.heroId} {run.mode} seed {run.seed}
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
    </main>
  ),
}));

const click = (name: string): void => {
  fireEvent.click(screen.getByRole('button', { name }));
};

const heading = (name: string): HTMLElement => screen.getByRole('heading', { level: 1, name });

/** Boots and starts a run with the defaults: Mike, day. */
function startRun(): void {
  click('Finish boot');
  click('Play');
  click('Start');
}

/** A gamepad in the standard mapping, and frames that run when the test says so. */
function installGamepad() {
  const pad = {
    index: 0,
    connected: true,
    buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
    axes: [0, 0, 0, 0],
  };
  const pads: (GamepadLike | null)[] = [pad];
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => pads });
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const frame = (): void => {
    const due = frames.splice(0);
    act(() => {
      for (const callback of due) {
        callback(0);
      }
    });
  };
  /** Presses a button for one frame and releases it in the next. */
  const tap = (button: number): void => {
    const control = pad.buttons[button];
    if (control === undefined) {
      throw new Error(`no button ${String(button)}`);
    }
    control.pressed = true;
    frame();
    control.pressed = false;
    frame();
  };
  return { tap };
}

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'getGamepads');
    unlock.mockClear();
    setVolume.mockClear();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    window.history.replaceState(null, '', '/');
  });

  it('boots first, then shows the main menu, and passes the accessibility check', async () => {
    const { container } = render(<App />);

    expect(screen.getByText('Boot attempt 0, loading')).toBeInTheDocument();

    click('Finish boot');

    expect(heading('Buzzkill')).toBeInTheDocument();
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Play',
      'Settings',
      'Help',
    ]);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows the failures of a boot and loads again on retry', () => {
    render(<App />);

    click('Fail boot');
    expect(screen.getByText('Boot attempt 0, 1 failed')).toBeInTheDocument();

    click('Try again');
    expect(screen.getByText('Boot attempt 1, loading')).toBeInTheDocument();
  });

  it('opens the hero select, the settings and the help from the menu; Back and Escape return', () => {
    render(<App />);
    click('Finish boot');

    click('Play');
    expect(heading('Choose your hero')).toBeInTheDocument();
    click('Back');
    expect(heading('Buzzkill')).toBeInTheDocument();

    click('Settings');
    expect(heading('Settings')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(heading('Buzzkill')).toBeInTheDocument();

    click('Help');
    expect(heading('Help')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(heading('Buzzkill')).toBeInTheDocument();

    // Escape has no meaning on the main menu.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(heading('Buzzkill')).toBeInTheDocument();
  });

  it('sets the mixer from the settings as soon as the assets exist, and follows every change', () => {
    render(<App />);
    expect(setVolume).not.toHaveBeenCalled();

    click('Finish boot');
    expect(setVolume.mock.calls).toEqual([
      ['effects', 0.3],
      ['music', 0.5],
    ]);

    click('Settings');
    setVolume.mockClear();
    fireEvent.click(screen.getByRole('switch', { name: 'Sound' }));
    expect(setVolume.mock.calls).toEqual([
      ['effects', 0],
      ['music', 0],
    ]);

    setVolume.mockClear();
    fireEvent.change(screen.getByRole('slider', { name: 'Effects volume' }), {
      target: { value: '0.7' },
    });
    fireEvent.click(screen.getByRole('switch', { name: 'Sound' }));
    expect(setVolume.mock.calls.at(-2)).toEqual(['effects', 0.7]);
    expect(setVolume.mock.calls.at(-1)).toEqual(['music', 0.5]);
  });

  it('starts the chosen run with the seed of the URL and starts the audio in the click', () => {
    window.history.replaceState(null, '', '/?seed=7');
    render(<App />);
    click('Finish boot');
    click('Play');

    fireEvent.click(screen.getByRole('radio', { name: 'Julie' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Night' }));
    click('Start');

    expect(screen.getByText('Game view: female night seed 7')).toBeInTheDocument();
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
    fireEvent.keyDown(document, { key: 'a', code: 'KeyA' });
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'p', code: 'KeyP' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    click('Game pauses itself');
    click('Quit to menu');
    expect(heading('Buzzkill')).toBeInTheDocument();
  });

  it('ends a lost run as game over and a won run as level complete, over the running view', async () => {
    window.history.replaceState(null, '', '/?seed=7');
    const { container } = render(<App />);
    startRun();

    click('Lose');
    const dialog = screen.getByRole('dialog', { name: 'Game over' });
    expect(dialog).toHaveAccessibleDescription('Score: 42');
    expect(screen.getByText('Game view: male day seed 7')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    click('Play again');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(unlock).toHaveBeenCalledTimes(2);

    click('Win');
    expect(screen.getByRole('dialog', { name: 'Level complete' })).toBeInTheDocument();

    click('Back to menu');
    expect(heading('Buzzkill')).toBeInTheDocument();
  });

  it('follows the system theme until the player picks one in the settings, then remembers it', () => {
    render(<App />);
    click('Finish boot');
    expect(document.documentElement).not.toHaveAttribute('data-theme');
    expect(localStorage.getItem('buzzkill.settings')).toBeNull();

    click('Settings');
    fireEvent.click(screen.getByRole('tab', { name: 'Display' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Always night' }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'night');
    expect(screen.getByRole('radio', { name: 'Always night' })).toBeChecked();
    expect(JSON.parse(localStorage.getItem('buzzkill.settings') ?? '{}')).toMatchObject({
      version: 1,
      theme: 'night',
    });
  });

  it('keeps every setting across a reload', () => {
    const view = render(<App />);
    click('Finish boot');
    click('Settings');
    fireEvent.click(screen.getByRole('tab', { name: 'Gameplay' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Hard' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Controls' }));
    fireEvent.click(screen.getByRole('button', { name: 'Shoot, key 2: J' }));
    fireEvent.keyDown(document.body, { key: 'f', code: 'KeyF' });
    view.unmount();

    render(<App />);
    click('Finish boot');
    click('Settings');
    fireEvent.click(screen.getByRole('tab', { name: 'Gameplay' }));
    expect(screen.getByRole('radio', { name: 'Hard' })).toBeChecked();
    fireEvent.click(screen.getByRole('tab', { name: 'Controls' }));
    expect(screen.getByRole('button', { name: 'Shoot, key 2: F' })).toBeInTheDocument();
  });

  it("shows the player's keys in the help", () => {
    render(
      <App
        settings={createSettingsStore({
          ...DEFAULT_SETTINGS,
          keyBindings: { ...DEFAULT_SETTINGS.keyBindings, fire: ['KeyF', 'KeyJ'] },
        })}
      />,
    );
    click('Finish boot');
    click('Help');

    expect(screen.getByRole('region', { name: 'Keyboard' })).toHaveTextContent('F or J');
  });

  it("resumes on the player's pause key, not on the default one it replaced", () => {
    const run: Run = { heroId: 'male', mode: 'day', seed: 3 };
    render(
      <App
        store={createAppStore({ name: 'paused', assets, run })}
        settings={createSettingsStore({
          ...DEFAULT_SETTINGS,
          keyBindings: { ...DEFAULT_SETTINGS.keyBindings, pause: ['KeyQ', 'KeyE'] },
        })}
      />,
    );

    fireEvent.keyDown(document, { key: 'p', code: 'KeyP' });
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'q', code: 'KeyQ' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it("moves the theme of #75 into the settings and uses the run's time of day while a run is on screen", () => {
    localStorage.setItem('buzzkill.theme', 'night');
    render(<App />);
    click('Finish boot');
    expect(document.documentElement).toHaveAttribute('data-theme', 'night');
    expect(localStorage.getItem('buzzkill.theme')).toBeNull();
    expect(JSON.parse(localStorage.getItem('buzzkill.settings') ?? '{}')).toMatchObject({
      version: 1,
      theme: 'night',
    });

    click('Play');
    click('Start');
    expect(document.documentElement).toHaveAttribute('data-theme', 'day');

    click('Lose');
    expect(document.documentElement).toHaveAttribute('data-theme', 'day');

    click('Back to menu');
    expect(document.documentElement).toHaveAttribute('data-theme', 'night');
  });

  it('renders the state of the stores it is given', () => {
    const run: Run = { heroId: 'female', mode: 'night', seed: 3 };
    render(
      <App
        store={createAppStore({ name: 'paused', assets, run })}
        settings={createSettingsStore({ ...DEFAULT_SETTINGS, muted: true })}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument();
    expect(screen.getByText('Game view: female night seed 3, held')).toBeInTheDocument();
    expect(setVolume).toHaveBeenCalledWith('effects', 0);
  });

  it('lets a gamepad move focus in the menu, select with A and go back with B', () => {
    const { tap } = installGamepad();
    render(<App />);
    click('Finish boot');

    tap(13);
    expect(screen.getByRole('button', { name: 'Play' })).toHaveFocus();
    tap(13);
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveFocus();
    tap(12);
    expect(screen.getByRole('button', { name: 'Play' })).toHaveFocus();

    tap(0);
    expect(heading('Choose your hero')).toBeInTheDocument();

    tap(1);
    expect(heading('Buzzkill')).toBeInTheDocument();
  });
});
