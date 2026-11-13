import { DIFFICULTIES } from '@buzzkill/game';
import { type JSX, lazy, Suspense, useEffect, useRef, useState } from 'react';

import { AnnouncerProvider, createAnnouncer } from './announcer';
import { ErrorBoundary } from './ErrorBoundary';
import { ErrorScreen } from './ErrorScreen';
import { importGameChunk } from './game/import-chunk';
import { seedForRun } from './game/run-options';
import { createGamepadNavigation } from './gamepad-navigation';
import { HelpScreen } from './HelpScreen';
import { HeroSelectScreen } from './HeroSelectScreen';
import { i18nFor, I18nProvider } from './i18n/i18n';
import { LevelClearedDialog } from './LevelClearedDialog';
import { LoadingScreen } from './LoadingScreen';
import { MenuScreen } from './MenuScreen';
import { applyMotion, reducesMotion, usePrefersReducedMotion } from './motion';
import { PauseDialog } from './PauseDialog';
import { RunOverDialog } from './RunOverDialog';
import { SettingsScreen } from './SettingsScreen';
import { createGameLoader } from './state/game-loader';
import {
  type AppEvent,
  type AppState,
  type AppStore,
  createAppStore,
  isRunState,
  type MenuPanel,
  type RunChoice,
} from './state/machine';
import { defaultSettings } from './state/settings/schema';
import { browserStorage, loadSettings } from './state/settings/storage';
import {
  createSettingsStore,
  persistSettings,
  type SettingsStore,
  volumeOf,
} from './state/settings/store';
import { useStore } from './state/use-store';
import { applyTheme } from './theme';

interface AppProps {
  /** The store of the flow. The app creates its own when none is given; a test starts anywhere. */
  readonly store?: AppStore;
  /**
   * The settings store; the app creates its own from `localStorage` when none is given, with the
   * browser's language as the default language.
   */
  readonly settings?: SettingsStore;
}

const whole = <T,>(value: T): T => value;

/** The game view comes with the game chunk (#112): the menus render without its code. */
const GameView = lazy(() => importGameChunk().then(({ GameView }) => ({ default: GameView })));

const reload = (): void => {
  window.location.reload();
};

/** The way back from a screen or a dialog, for Escape and the gamepad's B button; `null` without one. */
function backEvent(state: AppState): AppEvent | null {
  switch (state.name) {
    case 'playing':
      return null;
    case 'menu':
      return state.panel === 'main' ? null : { type: 'back' };
    case 'heroSelect':
    case 'loading':
      return { type: 'back' };
    case 'paused':
      return { type: 'resume' };
    case 'levelCleared':
      return { type: 'nextLevel' };
    case 'victory':
    case 'gameOver':
      return { type: 'quit' };
    case 'failed':
      return { type: 'restart' };
  }
}

/**
 * Application shell: renders the screen of the machine's state (ADR-0006) and nothing else. The
 * screens and the game report through `send`; the effects here are the ones the whole page needs:
 * saving the settings, the theme, the language, the mixer's volumes, the start of a run once the
 * game has loaded, the keys that go back, and the gamepad in the menus.
 */
export function App({ store: givenStore, settings: givenSettings }: AppProps): JSX.Element {
  const [ownStore] = useState(() => createAppStore());
  const [ownSettings] = useState(() =>
    createSettingsStore(
      loadSettings(browserStorage(), defaultSettings(window.navigator.languages)),
    ),
  );
  const [gameLoader] = useState(() => createGameLoader());
  const [announcer] = useState(() => createAnnouncer());
  const store = givenStore ?? ownStore;
  const settingsStore = givenSettings ?? ownSettings;
  const state = useStore(store, whole);
  const settings = useStore(settingsStore, whole);
  const gameLoad = useStore(gameLoader, whole);
  const { send } = store;
  const rootRef = useRef<HTMLDivElement>(null);
  const assets = isRunState(state) ? state.assets : null;
  const time = isRunState(state) ? state.time : null;
  const i18n = i18nFor(settings.language);

  // The theme of the page (#75): the player's setting on the menus, the time of day on screen
  // while a run is there, so the HUD and the dialogs match the sky as the levels change it.
  useEffect(() => {
    applyTheme(time ?? settings.theme);
  }, [time, settings.theme]);

  // Reduced or full motion for the interface, or the system's preference (#114); the canvas
  // gets the same answer in code, for the parallax of the city.
  useEffect(() => {
    applyMotion(settings.motion);
  }, [settings.motion]);
  const reducedMotion = reducesMotion(settings.motion, usePrefersReducedMotion());

  // The language of the page for assistive technology, hyphenation and fonts (ADR-0013).
  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  // Every change of the settings is saved at once, under the versioned schema (#110).
  useEffect(() => persistSettings(settingsStore, browserStorage()), [settingsStore]);

  // The mixer follows the settings while a run is on screen, from its first frame.
  useEffect(() => {
    if (assets === null) {
      return;
    }
    assets.audio.setVolume('effects', volumeOf(settings, 'effects'));
    assets.audio.setVolume('music', volumeOf(settings, 'music'));
  }, [assets, settings]);

  // The chosen run starts as soon as the game has loaded, or at once when it already had.
  useEffect(() => {
    if (state.name === 'loading' && gameLoad.status === 'ready') {
      send({ type: 'gameLoaded', assets: gameLoad.assets });
    }
  }, [state.name, gameLoad, send]);

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

  // Escape leaves a screen the way its Back or Restart button does; the dialogs handle Escape
  // themselves.
  const escapeGoesBack =
    state.name === 'heroSelect' ||
    state.name === 'loading' ||
    state.name === 'failed' ||
    (state.name === 'menu' && state.panel !== 'main');
  useEffect(() => {
    if (!escapeGoesBack) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      const back = backEvent(store.getState());
      if (event.key === 'Escape' && back !== null) {
        store.send(back);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [escapeGoesBack, store]);

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

  const play = (choice: RunChoice): void => {
    // Loads the game if no hover did, or again after a failure. Browsers start audio only in
    // response to a gesture, and this click is one, even while the game is still loading.
    gameLoader.load();
    gameLoader.unlockAudio();
    send({
      type: 'play',
      run: {
        heroId: choice.heroId,
        mode: choice.mode,
        seed: seedForRun(window.location.search),
        speed: settings.gameSpeed,
        difficulty: settings.difficulty,
      },
    });
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
              gameLoader.load();
              send({ type: 'selectHero' });
            }}
            onPreload={gameLoader.load}
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
        return (
          <HelpScreen
            keyBindings={settings.keyBindings}
            lives={DIFFICULTIES[settings.difficulty].lives}
            onBack={back}
          />
        );
    }
  };

  const loadingScreen = (
    <LoadingScreen load={gameLoad} onRetry={gameLoader.load} onReload={reload} onBack={back} />
  );

  const screen = (): JSX.Element => {
    switch (state.name) {
      case 'menu':
        return menuPanel(state.panel);
      case 'heroSelect':
        return <HeroSelectScreen onStart={play} onBack={back} />;
      case 'loading':
        return loadingScreen;
      case 'failed':
        return (
          <ErrorScreen
            area="game"
            onRestart={() => {
              send({ type: 'restart' });
            }}
          />
        );
      case 'playing':
      case 'paused':
      case 'levelCleared':
      case 'victory':
      case 'gameOver':
        return (
          // An error in the run makes the boundary send `runFailed`, and the screen of `failed`
          // replaces this branch at once, so the boundary itself shows nothing (#113).
          <ErrorBoundary
            area="game"
            fallback={null}
            onError={() => {
              send({ type: 'runFailed' });
            }}
          >
            {/* The loading screen stays until React has the code of the game view in place. */}
            <Suspense fallback={loadingScreen}>
              <GameView
                run={state.run}
                assets={state.assets}
                paused={state.name === 'paused'}
                betweenLevels={state.name === 'levelCleared'}
                keyBindings={settings.keyBindings}
                reducedMotion={reducedMotion}
                onEvent={send}
              />
            </Suspense>
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
            {state.name === 'levelCleared' && (
              <LevelClearedDialog
                level={state.level}
                score={state.score}
                time={state.time}
                nextTime={state.nextTime}
                onNext={() => {
                  send({ type: 'nextLevel' });
                }}
                onQuit={() => {
                  send({ type: 'quit' });
                }}
              />
            )}
            {(state.name === 'victory' || state.name === 'gameOver') && (
              <RunOverDialog
                title={i18n.t.runOver.titles[state.name]}
                result={state.result}
                onPlayAgain={() => {
                  play(state.run);
                }}
                onQuit={() => {
                  send({ type: 'quit' });
                }}
              />
            )}
          </ErrorBoundary>
        );
    }
  };

  return (
    <I18nProvider i18n={i18n}>
      <AnnouncerProvider announcer={announcer}>
        <div ref={rootRef} className="shell">
          {screen()}
        </div>
      </AnnouncerProvider>
    </I18nProvider>
  );
}
