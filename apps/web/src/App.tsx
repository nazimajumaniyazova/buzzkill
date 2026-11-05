import { createBrowserAudioContext } from '@buzzkill/engine/browser';
import { type JSX, useState } from 'react';

import { GameSession } from './GameSession';
import { type StartChoice, StartScreen } from './StartScreen';

/**
 * Application shell: the start screen until the player presses Play, then a game session. The
 * state machine of stage 5 (menu, playing, paused, game over) replaces this switch.
 */
export function App(): JSX.Element {
  const [choice, setChoice] = useState<StartChoice | null>(null);
  // One audio context for the page, created and started by the first Play click: browsers allow
  // audio to start only in response to a gesture.
  const [audioContext, setAudioContext] = useState<AudioContext | null | undefined>(undefined);

  if (choice === null) {
    return (
      <StartScreen
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
