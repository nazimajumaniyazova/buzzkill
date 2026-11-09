import { DEFAULT_KEY_BINDINGS } from '@buzzkill/game';
import { type JSX, useEffect, useState } from 'react';

import { BootScreen } from './BootScreen';
import { seedForRun } from './game/run-options';
import { GameView } from './GameView';
import { HeroSelectScreen } from './HeroSelectScreen';
import { MenuScreen } from './MenuScreen';
import { PauseDialog } from './PauseDialog';
import { RunOverDialog } from './RunOverDialog';
import {
  type AppState,
  type AppStore,
  createAppStore,
  type GameAssets,
  isRunState,
  type RunChoice,
} from './state/machine';
import { useStore } from './state/use-store';
import { applyTheme, readThemeChoice, type ThemeChoice, writeThemeChoice } from './theme';

const PAUSE_KEYS: readonly string[] = DEFAULT_KEY_BINDINGS.pause;

const RUN_OVER_TITLES = {
  levelComplete: 'Level complete',
  gameOver: 'Game over',
} as const satisfies Record<Extract<AppState['name'], 'levelComplete' | 'gameOver'>, string>;

interface AppProps {
  /** The store of the flow. The app creates its own when none is given; a test starts anywhere. */
  readonly store?: AppStore;
}

const whole = (state: AppState): AppState => state;

/**
 * Application shell: renders the screen of the machine's state (ADR-0006) and nothing else. The
 * screens and the game report through `send`; the effects here are the two the whole page needs,
 * the theme and the pause key.
 */
export function App({ store: given }: AppProps): JSX.Element {
  const [own] = useState(() => createAppStore());
  const store = given ?? own;
  const state = useStore(store, whole);
  const { send } = store;
  const [theme, setTheme] = useState<ThemeChoice>(readThemeChoice);
  const run = isRunState(state) ? state.run : null;

  // The theme of the page (#75): the player's setting on the menus, the run's own time of day
  // while a run is on screen, so the HUD and the dialogs match the sky.
  useEffect(() => {
    applyTheme(run === null ? theme : run.mode);
  }, [run, theme]);

  // The loop does not sample input while paused, so the pause key resumes from here.
  useEffect(() => {
    if (state.name !== 'paused') {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (PAUSE_KEYS.includes(event.code)) {
        event.preventDefault();
        send({ type: 'resume' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [state.name, send]);

  const play = (assets: GameAssets, choice: RunChoice): void => {
    // Browsers start audio only in response to a gesture, and this click is one.
    void assets.audio.unlock();
    send({ type: 'play', run: { ...choice, seed: seedForRun(window.location.search) } });
  };

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
      return (
        <MenuScreen
          theme={theme}
          onThemeChange={(next) => {
            setTheme(next);
            writeThemeChoice(next);
          }}
          onPlay={() => {
            send({ type: 'selectHero' });
          }}
        />
      );
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
}
