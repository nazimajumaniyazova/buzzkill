import type { AssetFailure } from '@buzzkill/engine';
import type { GamepadLike } from '@buzzkill/engine/browser';
import type { RunResult } from '@buzzkill/game';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { App } from './App';
import { reportError } from './errors/report-error';
import { importGameChunk } from './game/import-chunk';
import type { GameAssetsResult } from './game/load-assets';
import { loadGameAssets } from './game/load-assets';
import type { GameEvent } from './state/bridge';
import { createAppStore, type GameAssets, type Run } from './state/machine';
import { DEFAULT_SETTINGS } from './state/settings/schema';
import { createSettingsStore } from './state/settings/store';

const setVolume = vi.hoisted(() => vi.fn());
// The shell calls setVolume; the game view, which uses the rest, is replaced below.
const assets = vi.hoisted(() => ({ sprites: {}, audio: { setVolume } }) as unknown as GameAssets);

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

// The game chunk with the two modules below replaced, as a download that arrives at once. The
// calls are counted: the menu must not download the game.
vi.mock('./game/import-chunk', async () => {
  const chunk = await import('./game/game-chunk');
  return { importGameChunk: vi.fn(() => Promise.resolve(chunk)) };
});

// The game chunk itself: files that load at once unless a test says otherwise.
vi.mock('./game/load-assets', () => ({
  loadGameAssets: vi.fn((_context: AudioContext | null, onProgress: (fraction: number) => void) => {
    onProgress(1);
    return Promise.resolve<GameAssetsResult>({ ok: true, assets });
  }),
}));

vi.mock('./errors/report-error', () => ({ reportError: vi.fn() }));

// The game view has effects of its own; here it is buttons that report what the real one would,
// and one that breaks its next render, as a failed run would.
vi.mock('./GameView', async () => {
  const { useState } = await import('react');
  return {
    GameView: function FakeGameView({
      run,
      paused,
      onEvent,
    }: {
      run: Run;
      paused: boolean;
      onEvent: (event: GameEvent) => void;
    }) {
      const [broken, setBroken] = useState(false);
      if (broken) {
        throw new Error('The game view broke');
      }
      return (
        <main aria-label="Game">
          <p>
            Game view: {run.heroId} {run.mode} seed {run.seed}
            {paused ? ', held' : ''}
          </p>
          <p>Speed {run.speed}</p>
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
          <button
            type="button"
            onClick={() => {
              setBroken(true);
            }}
          >
            Break the run
          </button>
        </main>
      );
    },
  };
});

/** A load of the files that the test finishes: its progress, then success or failure. */
function holdTheFiles() {
  let report: (fraction: number) => void = () => undefined;
  let settle: (result: GameAssetsResult) => void = () => undefined;
  vi.mocked(loadGameAssets).mockImplementationOnce((_context, onProgress) => {
    report = onProgress;
    return new Promise((resolve) => {
      settle = resolve;
    });
  });
  return {
    progress: (fraction: number) => {
      act(() => {
        report(fraction);
      });
    },
    finish: async (result: GameAssetsResult) => {
      await act(async () => {
        settle(result);
        await Promise.resolve();
      });
    },
  };
}

/** Enough of an AudioContext for the loader, with its resume watched. */
class FakeAudioContext {
  static created: FakeAudioContext[] = [];
  state = 'suspended';
  resume = vi.fn(() => Promise.resolve());
  constructor() {
    FakeAudioContext.created.push(this);
  }
}

const click = (name: string): void => {
  fireEvent.click(screen.getByRole('button', { name }));
};

const heading = (name: string): HTMLElement => screen.getByRole('heading', { level: 1, name });

/** Waits for the game view: the chunk and the files load, and React renders the lazy view. */
const gameView = (): Promise<HTMLElement> => screen.findByText(/^Game view:/);

/** Starts a run with the defaults, Mike and day, and waits until it is on screen. */
async function startRun(): Promise<void> {
  click('Play');
  click('Start');
  await gameView();
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
  afterEach(async () => {
    // A load that a test started ends here, inside act, before the next test counts the calls.
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'getGamepads');
    setVolume.mockClear();
    vi.mocked(importGameChunk).mockClear();
    // Back to the files that load at once, dropping a held load that no call took.
    vi.mocked(loadGameAssets).mockReset();
    FakeAudioContext.created = [];
    vi.restoreAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('lang');
    document.documentElement.removeAttribute('data-motion');
    window.history.replaceState(null, '', '/');
  });

  it('shows the main menu first, without downloading the game, and passes the accessibility check', async () => {
    const { container } = render(<App />);

    expect(heading('Buzzkill')).toBeInTheDocument();
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Play',
      'Settings',
      'Help',
    ]);
    expect(await axe(container)).toHaveNoViolations();
    expect(importGameChunk).not.toHaveBeenCalled();
    expect(loadGameAssets).not.toHaveBeenCalled();
  });

  it('starts loading the game when the pointer enters Play or Play gets focus, once', async () => {
    render(<App />);
    const play = screen.getByRole('button', { name: 'Play' });

    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Settings' }));
    expect(importGameChunk).not.toHaveBeenCalled();

    fireEvent.pointerEnter(play);
    expect(importGameChunk).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(loadGameAssets).toHaveBeenCalledOnce();
    });

    act(() => {
      play.focus();
    });
    click('Play');
    expect(importGameChunk).toHaveBeenCalledOnce();
    expect(heading('Choose your hero')).toBeInTheDocument();
  });

  it('starts loading on the Play click too, which touch screens give without a hover', () => {
    render(<App />);

    click('Play');

    expect(importGameChunk).toHaveBeenCalledOnce();
  });

  it('shows the progress when the run starts before the game has loaded, then starts it', async () => {
    const files = holdTheFiles();
    render(<App />);
    click('Play');
    click('Start');

    const progress = await screen.findByRole('progressbar', { name: 'Loading' });
    files.progress(0.5);
    expect(progress).toHaveAttribute('value', '0.5');

    await files.finish({ ok: true, assets });
    expect(await gameView()).toHaveTextContent('Game view: male day');
  });

  it('lists what failed, loads it again on Try again, and starts the run once it is there', async () => {
    const files = holdTheFiles();
    render(<App />);
    click('Play');
    click('Start');
    await waitFor(() => {
      expect(loadGameAssets).toHaveBeenCalledOnce();
    });

    await files.finish({ ok: false, failures: [failure] });
    expect(screen.getByRole('alert')).toHaveTextContent('projectile.png');

    click('Try again');
    expect(await gameView()).toBeInTheDocument();
    expect(loadGameAssets).toHaveBeenCalledTimes(2);
  });

  it('goes back from the loading screen to the hero select with Back or Escape', async () => {
    holdTheFiles();
    render(<App />);
    click('Play');
    click('Start');
    await screen.findByRole('progressbar', { name: 'Loading' });

    click('Back');
    expect(heading('Choose your hero')).toBeInTheDocument();

    click('Start');
    expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(heading('Choose your hero')).toBeInTheDocument();
  });

  it('starts a run at once, in the Start click, when the game has loaded already', async () => {
    render(<App />);
    await startRun();
    click('Game pauses itself');
    click('Quit to menu');

    click('Play');
    click('Start');

    expect(screen.getByText(/^Game view:/)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('opens the hero select, the settings and the help from the menu; Back and Escape return', () => {
    render(<App />);

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

  it('sets the mixer from the settings when a run starts, with the settings of that moment', async () => {
    render(<App />);
    expect(setVolume).not.toHaveBeenCalled();

    await startRun();
    expect(setVolume.mock.calls).toEqual([
      ['effects', 0.3],
      ['music', 0.5],
    ]);

    click('Game pauses itself');
    click('Quit to menu');
    click('Settings');
    setVolume.mockClear();
    fireEvent.click(screen.getByRole('switch', { name: 'Sound' }));
    expect(setVolume).not.toHaveBeenCalled();

    click('Back');
    await startRun();
    expect(setVolume.mock.calls).toEqual([
      ['effects', 0],
      ['music', 0],
    ]);
  });

  it('starts the audio inside the Start click, while the files are still loading', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    holdTheFiles();
    render(<App />);
    click('Play');
    expect(FakeAudioContext.created).toHaveLength(1);
    expect(FakeAudioContext.created[0]?.resume).not.toHaveBeenCalled();

    click('Start');

    expect(FakeAudioContext.created[0]?.resume).toHaveBeenCalledOnce();
    expect(FakeAudioContext.created).toHaveLength(1);
    expect(screen.queryByText(/^Game view:/)).not.toBeInTheDocument();
  });

  it('starts the run the player chose, with the seed of the URL', async () => {
    window.history.replaceState(null, '', '/?seed=7');
    render(<App />);
    click('Play');

    fireEvent.click(screen.getByRole('radio', { name: 'Julie' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Night' }));
    click('Start');

    expect(await gameView()).toHaveTextContent('Game view: female night seed 7');
  });

  it("pauses on the game's report, resumes by button or pause key, and quits to the menu", async () => {
    const { container } = render(<App />);
    await startRun();
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
    vi.stubGlobal('AudioContext', FakeAudioContext);
    window.history.replaceState(null, '', '/?seed=7');
    const { container } = render(<App />);
    await startRun();

    click('Lose');
    const dialog = screen.getByRole('dialog', { name: 'Game over' });
    expect(dialog).toHaveAccessibleDescription('Score: 42');
    expect(screen.getByText('Game view: male day seed 7')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    click('Play again');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(FakeAudioContext.created[0]?.resume).toHaveBeenCalledTimes(2);
    expect(loadGameAssets).toHaveBeenCalledOnce();

    click('Win');
    expect(screen.getByRole('dialog', { name: 'Level complete' })).toBeInTheDocument();

    click('Back to menu');
    expect(heading('Buzzkill')).toBeInTheDocument();
  });

  it('follows the system theme until the player picks one in the settings, then remembers it', () => {
    render(<App />);
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
    click('Settings');
    fireEvent.click(screen.getByRole('tab', { name: 'Gameplay' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Hard' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Controls' }));
    fireEvent.click(screen.getByRole('button', { name: 'Shoot, key 2: J' }));
    fireEvent.keyDown(document.body, { key: 'f', code: 'KeyF' });
    view.unmount();

    render(<App />);
    click('Settings');
    fireEvent.click(screen.getByRole('tab', { name: 'Gameplay' }));
    expect(screen.getByRole('radio', { name: 'Hard' })).toBeChecked();
    fireEvent.click(screen.getByRole('tab', { name: 'Controls' }));
    expect(screen.getByRole('button', { name: 'Shoot, key 2: F' })).toBeInTheDocument();
  });

  it('switches the language at once, without a reload, and the lang of the page follows', () => {
    render(<App />);
    expect(document.documentElement).toHaveAttribute('lang', 'en');

    click('Settings');
    fireEvent.click(screen.getByRole('tab', { name: 'Display' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Русский' }));

    expect(document.documentElement).toHaveAttribute('lang', 'ru');
    expect(heading('Настройки')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Экран' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('radio', { name: 'Русский' })).toBeChecked();
    expect(JSON.parse(localStorage.getItem('buzzkill.settings') ?? '{}')).toMatchObject({
      language: 'ru',
    });

    click('Назад');
    expect(screen.getByRole('button', { name: 'Играть' })).toBeInTheDocument();
  });

  it("starts in the browser's language until the player picks one", () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ru-RU', 'en-US']);
    const view = render(<App />);

    expect(screen.getByRole('button', { name: 'Играть' })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('lang', 'ru');
    expect(localStorage.getItem('buzzkill.settings')).toBeNull();
    view.unmount();

    localStorage.setItem(
      'buzzkill.settings',
      JSON.stringify({ version: 1, ...DEFAULT_SETTINGS, language: 'en' }),
    );
    render(<App />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('titles the end of a run and writes its score in the language of the settings', async () => {
    render(<App settings={createSettingsStore({ ...DEFAULT_SETTINGS, language: 'ru' })} />);
    click('Играть');
    click('Начать');
    await gameView();

    click('Lose');
    expect(screen.getByRole('dialog', { name: 'Игра окончена' })).toHaveAccessibleDescription(
      'Счёт: 42',
    );
    click('Играть снова');
    click('Win');
    expect(screen.getByRole('dialog', { name: 'Уровень пройден' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Закрыть' })).toBeInTheDocument();
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
    click('Help');

    expect(screen.getByRole('region', { name: 'Keyboard' })).toHaveTextContent('F or J');
  });

  it("resumes on the player's pause key, not on the default one it replaced", () => {
    const run: Run = { heroId: 'male', mode: 'day', seed: 3, speed: 1 };
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

  it("moves the theme of #75 into the settings and uses the run's time of day while a run is on screen", async () => {
    localStorage.setItem('buzzkill.theme', 'night');
    render(<App />);
    expect(document.documentElement).toHaveAttribute('data-theme', 'night');
    expect(localStorage.getItem('buzzkill.theme')).toBeNull();
    expect(JSON.parse(localStorage.getItem('buzzkill.settings') ?? '{}')).toMatchObject({
      version: 1,
      theme: 'night',
    });

    await startRun();
    expect(document.documentElement).toHaveAttribute('data-theme', 'day');

    click('Lose');
    expect(document.documentElement).toHaveAttribute('data-theme', 'day');

    click('Back to menu');
    expect(document.documentElement).toHaveAttribute('data-theme', 'night');
  });

  it('renders the state of the stores it is given, the game view once its code is in place', async () => {
    const run: Run = { heroId: 'female', mode: 'night', seed: 3, speed: 1 };
    render(
      <App
        store={createAppStore({ name: 'paused', assets, run })}
        settings={createSettingsStore({ ...DEFAULT_SETTINGS, muted: true })}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument();
    expect(setVolume).toHaveBeenCalledWith('effects', 0);
    expect(await screen.findByText('Game view: female night seed 3, held')).toBeInTheDocument();
  });

  it('shows the error screen when a run fails, and Restart or Escape returns to the menu', async () => {
    // As in main.tsx: the boundary reports what it catches.
    const { container } = render(<App />, { onCaughtError: () => undefined });
    await startRun();

    click('Break the run');

    expect(heading('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('The run stopped on an error');
    expect(screen.getByRole('button', { name: 'Restart' })).toHaveFocus();
    expect(screen.queryByRole('main', { name: 'Game' })).not.toBeInTheDocument();
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      new Error('The game view broke'),
      expect.objectContaining({ source: 'game' }),
    );
    expect(await axe(container)).toHaveNoViolations();

    click('Restart');
    expect(heading('Buzzkill')).toBeInTheDocument();

    // A run that fails while paused takes its dialog with it.
    await startRun();
    click('Game pauses itself');
    click('Break the run');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(heading('Buzzkill')).toBeInTheDocument();
    vi.mocked(reportError).mockClear();
  });

  it('keeps the live regions on every screen, applies the motion setting and paces the next run', async () => {
    render(<App />);
    expect(screen.getAllByRole('log')).toHaveLength(2);
    expect(document.documentElement).not.toHaveAttribute('data-motion');

    click('Settings');
    fireEvent.click(screen.getByRole('tab', { name: 'Display' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Reduced' }));
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduced');
    expect(screen.getAllByRole('log')).toHaveLength(2);

    fireEvent.click(screen.getByRole('tab', { name: 'Gameplay' }));
    fireEvent.click(screen.getByRole('radio', { name: '50%' }));
    click('Back');
    await startRun();

    expect(screen.getByText('Speed 0.5')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('buzzkill.settings') ?? '{}')).toMatchObject({
      motion: 'reduced',
      gameSpeed: 0.5,
    });
  });

  it('lets a gamepad leave the error screen of a failed run with B', () => {
    const { tap } = installGamepad();
    render(<App store={createAppStore({ name: 'failed' })} />);
    expect(heading('Something went wrong')).toBeInTheDocument();

    tap(1);

    expect(heading('Buzzkill')).toBeInTheDocument();
  });

  it('lets a gamepad move focus in the menu, select with A and go back with B', () => {
    const { tap } = installGamepad();
    render(<App />);

    tap(13);
    expect(screen.getByRole('button', { name: 'Play' })).toHaveFocus();
    tap(13);
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveFocus();
    tap(12);
    expect(screen.getByRole('button', { name: 'Play' })).toHaveFocus();
    // Focus on Play preloads the game, from the pad as from the keyboard.
    expect(importGameChunk).toHaveBeenCalledOnce();

    tap(0);
    expect(heading('Choose your hero')).toBeInTheDocument();

    tap(1);
    expect(heading('Buzzkill')).toBeInTheDocument();
  });
});
