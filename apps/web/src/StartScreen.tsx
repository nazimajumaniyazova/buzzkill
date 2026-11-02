import type { GameSettings, LegacyHero } from '@buzzkill/game/legacy';
import { type JSX, type SubmitEvent, useId, useState } from 'react';

/** What the player picked on the start screen; everything the legacy game needs to begin. */
export interface StartChoice {
  hero: LegacyHero;
  settings: GameSettings;
}

interface StartScreenProps {
  onStart: (choice: StartChoice) => void;
}

const HEROES: readonly { id: LegacyHero; name: string }[] = [
  { id: 'male', name: 'Mike' },
  { id: 'female', name: 'Julie' },
];

const MODES: readonly { id: GameSettings['mode']; name: string }[] = [
  { id: 'day', name: 'Day' },
  { id: 'night', name: 'Night' },
];

/**
 * Plain, keyboard-reachable start screen: hero, time of day and volume, then Play. It is written
 * from scratch; the design-system version replaces it in stage 5.
 */
export function StartScreen({ onStart }: StartScreenProps): JSX.Element {
  const titleId = useId();
  const [hero, setHero] = useState<LegacyHero>('male');
  const [mode, setMode] = useState<GameSettings['mode']>('day');
  const [volume, setVolume] = useState(0.3);

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onStart({ hero, settings: { mode, volume } });
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

      <p>Controls: arrow up and arrow down to move, Space to shoot.</p>

      <button type="submit">Play</button>
    </form>
  );
}
