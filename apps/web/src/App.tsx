import { type JSX, useEffect, useRef, useState } from 'react';

import { BootScreen } from './BootScreen';
import { seedForRun } from './game/run-options';
import { createGamepadNavigation } from './gamepad-navigation';
import { GameView } from './GameView';
import { HelpScreen } from './HelpScreen';
import { HeroSelectScreen } from './HeroSelectScreen';
import { MenuScreen } from './MenuScreen';
import { PauseDialog } from './PauseDialog';
import { RunOverDialog } from './RunOverDialog';
import { SettingsScreen } from './SettingsScreen';
import {
  type AppEvent,
  type AppState,
  type AppStore,
  createAppStore,
  type GameAssets,
  isRunState,
  type MenuPanel,
  type RunChoice,
} from './state/machine';
import { browserStorage, loadSettings } from './state/settings/storage';
import {
  createSettingsStore,
  persistSettings,
  type SettingsStore,
  volumeOf,
} from './state/settings/store';
import { useStore } from './state/use-store';
import { applyTheme } from './theme';

const RUN_OVER_TITLES = {
  levelComplete: 'Level complete',
  gameOver: 'Game over',
} as const satisfies Record<Extract<AppState['name'], 'levelComplete' | 'gameOver'>, string>;

interface AppProps {
  /** The store of the flow. The app creates its own when none is given; a test starts anywhere. */
  readonly store?: AppStore;
  /** The settings store; the app creates its own from `localStorage` when none is given. */
  readonly settings?: SettingsStore;
}

const whole = <T,>(value: T): T => value;

/** The way back from a screen or a dialog, for Escape and the gamepad's B button; `null` without one. */
function backEvent(state: AppState): AppEvent | null {
  switch (state.name) {
    case 'boot':
    case 'playing':
      return null;
    case 'menu':
      return state.panel === 'main' ? null : { type: 'back' };
    case 'heroSelect':
      return { type: 'back' };
    case 'paused':
      return { type: 'resume' };
    case 'levelComplete':
    case 'gameOver':
      return { type: 'quit' };
  }
}

/**
 * Application shell: renders the screen of the machine's state (ADR-0006) and nothing else. The
 * screens and the game report through `send`; the effects here are the ones the whole page needs:
 * saving the settings, the theme, the mixer's volumes, the keys that go back, and the gamepad in
 * the menus.
 */
export function App({ store: givenStore, settings: givenSettings }: AppProps): JSX.Element {
  const [ownStore] = useState(() => createAppStore());
  const [ownSettings] = useState(() => createSettingsStore(loadSettings(browserStorage())));
  const store = givenStore ?? ownStore;
  const settingsStore = givenSettings ?? ownSettings;
  const state = useStore(store, whole);
  const settings = useStore(settingsStore, whole);
  const { send } = store;
  const rootRef = useRef<HTMLDivElement>(null);
  const run = isRunState(state) ? state.run : null;
  const assets = state.name === 'boot' ? null : state.assets;

  // The theme of the page (#75): the player's setting on the menus, the run's own time of day
  // while a run is on screen, so the HUD and the dialogs match the sky.
  useEffect(() => {
    applyTheme(run === null ? settings.theme : run.mode);
  }, [run, settings.theme]);

  // Every change of the settings is saved at once, under the versioned schema (#110).
  useEffect(() => persistSettings(settingsStore, browserStorage()), [settingsStore]);

  // The mixer follows the settings from the moment the assets exist, during a run too.
  useEffect(() => {
    if (assets === null) {
      return;
    }
    assets.audio.setVolume('effects', volumeOf(settings, 'effects'));
    assets.audio.setVolume('music', volumeOf(settings, 'music'));
  }, [assets, settings]);

  // The loop does not sample input while paused, so the player's pause key resumes from here.
  const pauseKeys = settings.keyBindings.pause;
  useEffect(() => {
    if (state.name !== 'paused') {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (pauseKeys.includes(event.code)) {
        event.preventDefault();
        send({ type: 'resume' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [state.name, send, pauseKeys]);

  // Escape leaves a screen the way its Back button does; the dialogs handle Escape themselves.
  const escapeGoesBack =
    state.name === 'heroSelect' || (state.name === 'menu' && state.panel !== 'main');
  useEffect(() => {
    if (!escapeGoesBack) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        send({ type: 'back' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [escapeGoesBack, send]);

  // The gamepad moves focus in the menus and the dialogs; during play the game reads the pad.
  const navigating = state.name !== 'playing';
  useEffect(() => {
    if (!navigating) {
      return;
    }
    const navigation = createGamepadNavigation({
      root: () => document.querySelector<HTMLElement>('dialog[open]') ?? rootRef.current,
      onBack: () => {
        const back = backEvent(store.getState());
        if (back !== null) {
          store.send(back);
        }
      },
    });
    return () => {
      navigation.dispose();
    };
  }, [navigating, store]);

  const play = (gameAssets: GameAssets, choice: RunChoice): void => {
    // Browsers start audio only in response to a gesture, and this click is one.
    void gameAssets.audio.unlock();
    send({ type: 'play', run: { ...choice, seed: seedForRun(window.location.search) } });
  };

  const back = (): void => {
    send({ type: 'back' });
  };

  const menuPanel = (panel: MenuPanel): JSX.Element => {
    switch (panel) {
      case 'main':
        return (
          <MenuScreen
            onPlay={() => {
              send({ type: 'selectHero' });
            }}
            onSettings={() => {
              send({ type: 'openSettings' });
            }}
            onHelp={() => {
              send({ type: 'openHelp' });
            }}
          />
        );
      case 'settings':
        return (
          <SettingsScreen
            settings={settings}
            onChange={(changes) => {
              settingsStore.send({ type: 'change', changes });
            }}
            onBack={back}
          />
        );
      case 'help':
        return <HelpScreen keyBindings={settings.keyBindings} onBack={back} />;
    }
  };

  const screen = (): JSX.Element => {
    switch (state.name) {
      case 'boot':
        return (
          <BootScreen
            attempt={state.attempt}
            failures={state.failures}
            onEvent={send}
            onRetry={() => {
              send({ type: 'retry' });
            }}
          />
        );
      case 'menu':
        return menuPanel(state.panel);
      case 'heroSelect':
        return (
          <HeroSelectScreen
            onStart={(choice) => {
              play(state.assets, choice);
            }}
            onBack={() => {
              send({ type: 'back' });
            }}
          />
        );
      case 'playing':
      case 'paused':
      case 'levelComplete':
      case 'gameOver':
        return (
          <>
            <GameView
              run={state.run}
              assets={state.assets}
              paused={state.name === 'paused'}
              keyBindings={settings.keyBindings}
              onEvent={send}
            />
            {state.name === 'paused' && (
              <PauseDialog
                onResume={() => {
                  send({ type: 'resume' });
                }}
                onQuit={() => {
                  send({ type: 'quit' });
                }}
              />
            )}
            {(state.name === 'levelComplete' || state.name === 'gameOver') && (
              <RunOverDialog
                title={RUN_OVER_TITLES[state.name]}
                result={state.result}
                onPlayAgain={() => {
                  play(state.assets, state.run);
                }}
                onQuit={() => {
                  send({ type: 'quit' });
                }}
              />
            )}
          </>
        );
    }
  };

  return (
    <div ref={rootRef} className="shell">
      {screen()}
    </div>
  );
}
