import {
  type AchievementId,
  type AchievementProgress,
  DAILY_RUN,
  dailyDate,
  dailySeed,
  DIFFICULTIES,
  type Replay,
} from '@buzzkill/game';
import { ToastProvider } from '@buzzkill/ui';
import { type JSX, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { AchievementsScreen } from './AchievementsScreen';
import { AnnouncerProvider, createAnnouncer } from './announcer';
import { type Backend, createBackend } from './backend/client';
import { backendConfig } from './backend/config';
import type { StoredReplay } from './backend/replays';
import { type RunQueue, submissionBody } from './backend/run-queue';
import { createRunUploads } from './backend/run-uploads';
import { createUploadNews, type SendReason, type UploadNews } from './backend/upload-notices';
import { EarnedToasts } from './EarnedToasts';
import { ErrorBoundary } from './ErrorBoundary';
import { reportError } from './errors/report-error';
import { ErrorScreen } from './ErrorScreen';
import { canRumble, findVibrator } from './game/haptics';
import { importGameChunk } from './game/import-chunk';
import type { MusicStatus } from './game/music';
import { GAME_VERSION, seedForRun } from './game/run-options';
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
import { loadAchievements, saveAchievements } from './state/achievements/progress';
import { createAchievementsStore } from './state/achievements/store';
import { dailyBest, recordDailyScore } from './state/daily/best';
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
import { StoredReplayScreen } from './StoredReplayScreen';
import { applyTheme } from './theme';
import { UploadToasts } from './UploadToasts';

interface AppProps {
  /** The store of the flow. The app creates its own when none is given; a test starts anywhere. */
  readonly store?: AppStore;
  /**
   * The settings store; the app creates its own from `localStorage` when none is given, with the
   * browser's language as the default language.
   */
  readonly settings?: SettingsStore;
  /** The clock, for the day of the daily challenge (#165); a test sets the day. */
  readonly now?: () => Date;
  /**
   * The backend (ADR-0007), shared by the sending of runs and the boards, or `null` in a build
   * without one. The app makes its own from the build's environment when none is given; a test
   * gives a fake.
   */
  readonly backend?: Backend | null;
  /**
   * The finished runs on their way to the server (#220), or `null` without a backend. The app
   * makes its own from the build's environment when none is given; a test gives a fake.
   */
  readonly runQueue?: Pick<RunQueue, 'add' | 'flush'> | null;
  /**
   * Fetches the replay of a run of the boards (#219). The app reads it from its backend when none
   * is given; a test gives a fake.
   */
  readonly fetchReplay?: (runId: string) => Promise<StoredReplay>;
}

const whole = <T,>(value: T): T => value;

/** The game view comes with the game chunk (#112): the menus render without its code. */
const GameView = lazy(() => importGameChunk().then(({ GameView }) => ({ default: GameView })));

/** So does the replay view (#219), which plays a replay with the same code. */
const ReplayView = lazy(() =>
  importGameChunk().then(({ ReplayView }) => ({ default: ReplayView })),
);

const reload = (): void => {
  window.location.reload();
};

/** So do the boards (#220), with TanStack Query, when the player opens them. */
const BackendBoards = lazy(() =>
  import('./boards/BackendBoards').then(({ BackendBoards }) => ({ default: BackendBoards })),
);

/**
 * The backend of this build, or `null` when its environment names none. One for the whole page:
 * the runs and the boards share the client, and so the player's session.
 */
function browserBackend(): Backend | null {
  const config = backendConfig(import.meta.env);
  return config === null ? null : createBackend(config);
}

/**
 * The replay of a run of the boards, from `backend` (#219). The code that reads it downloads with
 * it, and anything that goes wrong on the way counts as the backend out of reach.
 */
async function fetchFromBackend(backend: Backend | null, runId: string): Promise<StoredReplay> {
  if (backend === null) {
    return { ok: false, problem: 'offline' };
  }
  try {
    const [client, { fetchReplay }] = await Promise.all([
      backend.client(),
      import('./backend/replays'),
    ]);
    return await fetchReplay(client, runId, GAME_VERSION);
  } catch {
    return { ok: false, problem: 'offline' };
  }
}

/** The queue of this build, or `null` when it has no backend (#220). */
const browserRunQueue = (backend: Backend | null): RunQueue | null =>
  createRunUploads({
    backend,
    storage: browserStorage(),
    fetch: (url, init) => window.fetch(url, init),
    locks: 'locks' in window.navigator ? window.navigator.locks : undefined,
    gameVersion: GAME_VERSION,
  });

/**
 * Sends what waits and tells the player what became of it (#222). A failure to send is a report
 * like any other; only a failure of the lock itself is unexpected.
 */
const sendWaitingRuns = (
  queue: Pick<RunQueue, 'flush'>,
  news: UploadNews,
  reason: SendReason,
): void => {
  queue.flush().then(
    (report) => {
      news.report(report, reason);
    },
    (error: unknown) => {
      reportError(error, { source: 'shell' });
    },
  );
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
    case 'watching':
    case 'storedReplay':
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

/** What the music does in each state (#161): it plays on between the levels, and stops off a run. */
function musicFor(name: AppState['name']): MusicStatus {
  switch (name) {
    case 'playing':
    case 'levelCleared':
      return 'playing';
    case 'paused':
      return 'paused';
    case 'menu':
    case 'heroSelect':
    case 'loading':
    case 'failed':
    case 'victory':
    case 'gameOver':
    case 'watching':
    case 'storedReplay':
      return 'stopped';
  }
}

/**
 * Application shell: renders the screen of the machine's state (ADR-0006) and nothing else. The
 * screens and the game report through `send`; the effects here are the ones the whole page needs:
 * saving the settings, the theme, the language, the mixer's volumes and the music, the start of a
 * run once the game has loaded, the keys that go back, and the gamepad in the menus.
 */
const systemClock = (): Date => new Date();

export function App({
  store: givenStore,
  settings: givenSettings,
  now = systemClock,
  backend: givenBackend,
  runQueue: givenRunQueue,
  fetchReplay: givenFetchReplay,
}: AppProps): JSX.Element {
  const [ownStore] = useState(() => createAppStore());
  const [backend] = useState(() => (givenBackend === undefined ? browserBackend() : givenBackend));
  const [runQueue] = useState(() =>
    givenRunQueue === undefined ? browserRunQueue(backend) : givenRunQueue,
  );
  const [uploadNews] = useState(() => createUploadNews());
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
  // A stored replay draws with the game's files and sets the theme as a run does (#219).
  const storedReady =
    state.name === 'storedReplay' && state.load.status === 'ready' ? state.load : null;
  const assets = isRunState(state) ? state.assets : (storedReady?.assets ?? null);
  const time = isRunState(state) ? state.time : (storedReady?.time ?? null);
  const i18n = i18nFor(settings.language);

  // The achievements of this device (#163), in a store the shell does not subscribe to: their
  // progress changes with nearly every insect (#109). The menu reads it whenever it renders.
  const [achievements] = useState(() =>
    createAchievementsStore(loadAchievements(browserStorage(), new Date().toISOString())),
  );
  const onAchievements = useCallback(
    (progress: AchievementProgress, earned: readonly AchievementId[]) => {
      achievements.send({ type: 'counted', progress, earned, at: new Date().toISOString() });
    },
    [achievements],
  );
  useEffect(
    () =>
      achievements.subscribe(() => {
        saveAchievements(achievements.getState(), browserStorage());
      }),
    [achievements],
  );

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

  // The music follows the run (#161): it plays during play and between the levels, holds its
  // place in a pause, and starts over with the next run. It outlives the run with the files.
  const music = gameLoad.status === 'ready' ? gameLoad.assets.music : null;
  const musicStatus = musicFor(state.name);
  useEffect(() => {
    music?.follow(musicStatus);
  }, [music, musicStatus]);

  // The chosen run starts as soon as the game has loaded, or at once when it already had; so does
  // the replay of a run of the boards, once it has come (#219).
  const waitsForGame =
    state.name === 'loading' || (state.name === 'storedReplay' && state.load.status === 'fetched');
  useEffect(() => {
    if (waitsForGame && gameLoad.status === 'ready') {
      send({ type: 'gameLoaded', assets: gameLoad.assets });
    }
  }, [waitsForGame, gameLoad, send]);

  // The replay of a run of the boards is fetched while the game loads, if it has not (#219). An
  // answer for a run no longer on screen is ignored by the machine.
  const fetchingRunId =
    state.name === 'storedReplay' && state.load.status === 'fetching' ? state.runId : null;
  useEffect(() => {
    if (fetchingRunId === null) {
      return;
    }
    gameLoader.load();
    const fetched =
      givenFetchReplay === undefined
        ? fetchFromBackend(backend, fetchingRunId)
        : givenFetchReplay(fetchingRunId);
    fetched.then(
      (stored) => {
        send(
          stored.ok
            ? { type: 'replayFetched', runId: fetchingRunId, replay: stored.replay }
            : { type: 'replayFailed', runId: fetchingRunId, problem: stored.problem },
        );
      },
      (error: unknown) => {
        reportError(error, { source: 'shell' });
        send({ type: 'replayFailed', runId: fetchingRunId, problem: 'offline' });
      },
    );
  }, [fetchingRunId, givenFetchReplay, backend, gameLoader, send]);

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
    state.name === 'watching' ||
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

  /**
   * Starts a run of `choice`; with `daily`, the daily run of that day (#165), whose seed is the
   * day's and which starts by day at the normal difficulty, whatever the settings say.
   */
  const play = (choice: RunChoice, daily: string | null): void => {
    // Loads the game if no hover did, or again after a failure. Browsers start audio only in
    // response to a gesture, and this click is one, even while the game is still loading.
    gameLoader.load();
    gameLoader.unlockAudio();
    send({
      type: 'play',
      run:
        daily === null
          ? {
              heroId: choice.heroId,
              mode: choice.mode,
              seed: seedForRun(window.location.search),
              speed: settings.gameSpeed,
              difficulty: settings.difficulty,
              daily: null,
            }
          : {
              heroId: choice.heroId,
              mode: DAILY_RUN.mode,
              seed: dailySeed(daily),
              speed: settings.gameSpeed,
              difficulty: DAILY_RUN.difficulty,
              daily,
            },
    });
  };

  // The best score of a daily run on this device, kept when the run ends (#165).
  const finished = state.name === 'victory' || state.name === 'gameOver' ? state : null;
  useEffect(() => {
    if (finished !== null && finished.run.daily !== null) {
      recordDailyScore(browserStorage(), finished.run.daily, finished.result.score);
    }
  }, [finished]);

  // Every finished run goes to the server through the queue (#220), which keeps it until the
  // server has it. Back from its replay, the same run comes back on screen: it is queued once.
  const queuedReplay = useRef<Replay | null>(null);
  useEffect(() => {
    if (runQueue === null || finished === null || queuedReplay.current === finished.replay) {
      return;
    }
    queuedReplay.current = finished.replay;
    runQueue.add(submissionBody(finished, finished.run.speed));
    sendWaitingRuns(runQueue, uploadNews, 'finished');
  }, [finished, runQueue, uploadNews]);

  // What an earlier visit left, and what waited for the network, goes as soon as it can.
  useEffect(() => {
    if (runQueue === null) {
      return;
    }
    sendWaitingRuns(runQueue, uploadNews, 'waiting');
    const onOnline = (): void => {
      sendWaitingRuns(runQueue, uploadNews, 'waiting');
    };
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
    };
  }, [runQueue, uploadNews]);

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
            onDaily={() => {
              gameLoader.load();
              send({ type: 'selectDaily', date: dailyDate(now()) });
            }}
            dailyBest={dailyBest(browserStorage(), dailyDate(now()))}
            onPreload={gameLoader.load}
            onSettings={() => {
              send({ type: 'openSettings' });
            }}
            onAchievements={() => {
              send({ type: 'openAchievements' });
            }}
            onBoards={
              backend === null
                ? undefined
                : () => {
                    send({ type: 'openBoards' });
                  }
            }
            onHelp={() => {
              send({ type: 'openHelp' });
            }}
          />
        );
      case 'achievements':
        return <AchievementsScreen progress={achievements.getState().progress} onBack={back} />;
      case 'settings':
        return (
          <SettingsScreen
            settings={settings}
            onChange={(changes) => {
              settingsStore.send({ type: 'change', changes });
            }}
            onBack={back}
            canVibrate={findVibrator(globalThis.navigator) !== null || canRumble(globalThis)}
          />
        );
      case 'boards':
        return (
          <Suspense fallback={<p className="screen">{i18n.t.boards.loading}</p>}>
            <BackendBoards
              backend={backend}
              today={dailyDate(now())}
              difficulty={settings.difficulty}
              onWatch={(runId) => {
                send({ type: 'watchRun', runId });
              }}
              onBack={back}
            />
          </Suspense>
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

  const replayEffects = {
    reducedMotion,
    particles: settings.particles,
    screenShake: settings.screenShake,
    hitFlash: settings.hitFlash,
    squashStretch: settings.squashStretch,
    hitStop: settings.hitStop,
  };

  const loadingScreen = (
    <LoadingScreen load={gameLoad} onRetry={gameLoader.load} onReload={reload} onBack={back} />
  );

  const storedReplayScreen = (
    stored: Extract<AppState, { readonly name: 'storedReplay' }>,
  ): JSX.Element => {
    switch (stored.load.status) {
      case 'fetching':
      case 'failed':
        return (
          <StoredReplayScreen
            problem={stored.load.status === 'failed' ? stored.load.problem : null}
            onRetry={() => {
              send({ type: 'watchRun', runId: stored.runId });
            }}
            onBack={back}
          />
        );
      case 'fetched':
        return loadingScreen;
      case 'ready':
        return (
          // An error in the replay makes the boundary send `runFailed`, as in a run (#113).
          <ErrorBoundary
            area="game"
            fallback={null}
            onError={() => {
              send({ type: 'runFailed' });
            }}
          >
            <Suspense fallback={loadingScreen}>
              <ReplayView
                replay={stored.load.replay}
                assets={stored.load.assets}
                effects={replayEffects}
                onTime={(time) => {
                  send({ type: 'replayTime', time });
                }}
                onBack={back}
              />
            </Suspense>
          </ErrorBoundary>
        );
    }
  };

  const screen = (): JSX.Element => {
    switch (state.name) {
      case 'menu':
        return menuPanel(state.panel);
      case 'heroSelect':
        return (
          <HeroSelectScreen
            daily={state.daily}
            progress={achievements.getState().progress}
            onStart={(choice) => {
              play(choice, state.daily);
            }}
            onBack={back}
          />
        );
      case 'loading':
        return loadingScreen;
      case 'storedReplay':
        return storedReplayScreen(state);
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
      case 'watching':
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
                // The finished run waits under its replay, to come back to it (#219).
                paused={state.name === 'paused' || state.name === 'watching'}
                hidden={state.name === 'watching'}
                betweenLevels={state.name === 'levelCleared'}
                keyBindings={settings.keyBindings}
                reducedMotion={reducedMotion}
                particles={settings.particles}
                screenShake={settings.screenShake}
                hitFlash={settings.hitFlash}
                squashStretch={settings.squashStretch}
                hitStop={settings.hitStop}
                vibration={settings.vibration}
                achievements={achievements.getState().progress}
                onAchievements={onAchievements}
                onEvent={send}
              />
            </Suspense>
            {state.name === 'paused' && (
              <PauseDialog
                reason={state.reason}
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
                  play(state.run, state.run.daily);
                }}
                onWatch={() => {
                  send({ type: 'watchReplay' });
                }}
                onQuit={() => {
                  send({ type: 'quit' });
                }}
              />
            )}
            {state.name === 'watching' && (
              // Apart from the run's own: the finished run stays mounted while this one loads.
              <Suspense fallback={null}>
                <ReplayView
                  replay={state.finished.replay}
                  assets={state.assets}
                  effects={replayEffects}
                  onTime={(time) => {
                    send({ type: 'replayTime', time });
                  }}
                  onBack={back}
                />
              </Suspense>
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
        <ToastProvider label={i18n.t.common.notifications}>
          <EarnedToasts store={achievements} />
          <UploadToasts news={uploadNews} />
        </ToastProvider>
      </AnnouncerProvider>
    </I18nProvider>
  );
}
