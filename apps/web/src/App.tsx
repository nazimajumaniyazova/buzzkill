import { createBrowserAudioContext } from '@buzzkill/engine/browser';
import { type JSX, useEffect, useState } from 'react';

import { GameSession } from './GameSession';
import { type StartChoice, StartScreen } from './StartScreen';
import { applyTheme, readThemeChoice, type ThemeChoice, writeThemeChoice } from './theme';

/**
 * Application shell: the start screen until the player presses Play, then a game session. The
 * state machine of stage 5 (menu, playing, paused, game over) replaces this switch.
 */
export function App(): JSX.Element {
  const [choice, setChoice] = useState<StartChoice | null>(null);
  const [theme, setTheme] = useState<ThemeChoice>(readThemeChoice);
  // One audio context for the page, created and started by the first Play click: browsers allow
  // audio to start only in response to a gesture.
  const [audioContext, setAudioContext] = useState<AudioContext | null | undefined>(undefined);

  // The theme of the page (#75): the player's setting on the menus, the run's own time of day
  // while playing, so the HUD and the dialogs match the sky.
  useEffect(() => {
    applyTheme(choice === null ? theme : choice.mode);
  }, [choice, theme]);

  if (choice === null) {
    return (
      <StartScreen
        theme={theme}
        onThemeChange={(next) => {
          setTheme(next);
          writeThemeChoice(next);
        }}
        onStart={(picked) => {
          const context = audioContext === undefined ? createBrowserAudioContext() : audioContext;
          void context?.resume().catch(() => undefined);
          setAudioContext(context);
          setChoice(picked);
        }}
      />
    );
  }
  return (
    <GameSession
      choice={choice}
      audioContext={audioContext ?? null}
      onExit={() => {
        setChoice(null);
      }}
    />
  );
}
