import type { GameMode, HeroId } from '@buzzkill/game';
import { KeyHint } from '@buzzkill/ui';
import { type JSX, type SubmitEvent, useId, useState } from 'react';

import type { ThemeChoice } from './theme';

/** What the player picked on the start screen. */
export interface StartChoice {
  readonly heroId: HeroId;
  readonly mode: GameMode;
  /** Volume of the sound effects, from 0 (muted) to 1. */
  readonly volume: number;
}

interface StartScreenProps {
  /** The player's theme setting; a page setting, not part of the run, so it is controlled. */
  theme: ThemeChoice;
  onThemeChange: (theme: ThemeChoice) => void;
  onStart: (choice: StartChoice) => void;
}

const HEROES: readonly { id: HeroId; name: string }[] = [
  { id: 'male', name: 'Mike' },
  { id: 'female', name: 'Julie' },
];

const MODES: readonly { id: GameMode; name: string }[] = [
  { id: 'day', name: 'Day' },
  { id: 'night', name: 'Night' },
];

const THEMES: readonly { id: ThemeChoice; name: string }[] = [
  { id: 'system', name: 'Match the system' },
  { id: 'day', name: 'Always day' },
  { id: 'night', name: 'Always night' },
];

/**
 * Plain, keyboard-reachable start screen: hero, time of day, volume and theme, then Play. It is
 * written from scratch; the design-system version replaces it in stage 5.
 */
export function StartScreen({ theme, onThemeChange, onStart }: StartScreenProps): JSX.Element {
  const titleId = useId();
  const [hero, setHero] = useState<HeroId>('male');
  const [mode, setMode] = useState<GameMode>('day');
  const [volume, setVolume] = useState(0.3);

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onStart({ heroId: hero, mode, volume });
  };

  return (
    <form className="start-screen" aria-labelledby={titleId} onSubmit={handleSubmit}>
      <h1 id={titleId}>Buzzkill</h1>
      <p>The year is 3023. Giant insects from outer space attack the city. Shoot them down.</p>

      <fieldset>
        <legend>Hero</legend>
        {HEROES.map((option) => (
          <label key={option.id}>
            <input
              type="radio"
              name="hero"
              value={option.id}
              checked={hero === option.id}
              onChange={() => {
                setHero(option.id);
              }}
            />
            {option.name}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Time of day</legend>
        {MODES.map((option) => (
          <label key={option.id}>
            <input
              type="radio"
              name="mode"
              value={option.id}
              checked={mode === option.id}
              onChange={() => {
                setMode(option.id);
              }}
            />
            {option.name}
          </label>
        ))}
      </fieldset>

      <label>
        Sound volume
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(event) => {
            setVolume(Number(event.target.value));
          }}
        />
      </label>

      <fieldset>
        <legend>Theme</legend>
        {THEMES.map((option) => (
          <label key={option.id}>
            <input
              type="radio"
              name="theme"
              value={option.id}
              checked={theme === option.id}
              onChange={() => {
                onThemeChange(option.id);
              }}
            />
            {option.name}
          </label>
        ))}
      </fieldset>

      <p>
        Controls: <KeyHint symbol="↑">Arrow up</KeyHint> and{' '}
        <KeyHint symbol="↓">Arrow down</KeyHint> to move, <KeyHint>Space</KeyHint> to shoot,{' '}
        <KeyHint>Escape</KeyHint> to pause.
      </p>

      <button type="submit">Play</button>
    </form>
  );
}
