import { type JSX, useState } from 'react';

import { GameCanvas } from './GameCanvas';
import { type StartChoice, StartScreen } from './StartScreen';

/**
 * Application shell: the start screen until the player presses Play, then the game canvas.
 * The state machine of stage 5 (menu, playing, paused, game over) replaces this boolean switch.
 */
export function App(): JSX.Element {
  const [choice, setChoice] = useState<StartChoice | null>(null);

  if (choice === null) {
    return <StartScreen onStart={setChoice} />;
  }
  return <GameCanvas hero={choice.hero} settings={choice.settings} />;
}
