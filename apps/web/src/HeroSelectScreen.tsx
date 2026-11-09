import type { GameMode, HeroId } from '@buzzkill/game';
import { Button, RadioGroup, type RadioOption, Slider } from '@buzzkill/ui';
import { type JSX, type SubmitEvent, useId, useState } from 'react';

import type { RunChoice } from './state/machine';

interface HeroSelectScreenProps {
  readonly onStart: (choice: RunChoice) => void;
  readonly onBack: () => void;
}

const HEROES = [
  { value: 'male', label: 'Mike' },
  { value: 'female', label: 'Julie' },
] as const satisfies readonly RadioOption<HeroId>[];

const MODES = [
  { value: 'day', label: 'Day' },
  { value: 'night', label: 'Night' },
] as const satisfies readonly RadioOption<GameMode>[];

const percent = (value: number): string => `${String(Math.round(value * 100))} %`;

/**
 * The `heroSelect` state: hero, time of day and volume, then Start. Plain and keyboard-reachable;
 * the design-system version arrives with #108.
 */
export function HeroSelectScreen({ onStart, onBack }: HeroSelectScreenProps): JSX.Element {
  const titleId = useId();
  const [heroId, setHeroId] = useState<HeroId>('male');
  const [mode, setMode] = useState<GameMode>('day');
  const [volume, setVolume] = useState(0.3);

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onStart({ heroId, mode, volume });
  };

  return (
    <form className="start-screen" aria-labelledby={titleId} onSubmit={handleSubmit}>
      <h1 id={titleId}>Choose your hero</h1>

      <RadioGroup
        label="Hero"
        name="hero"
        options={HEROES}
        value={heroId}
        onValueChange={setHeroId}
      />
      <RadioGroup
        label="Time of day"
        name="mode"
        options={MODES}
        value={mode}
        onValueChange={setMode}
      />
      <Slider
        label="Sound volume"
        min={0}
        max={1}
        step={0.1}
        value={volume}
        onValueChange={setVolume}
        formatValue={percent}
      />

      <div className="actions">
        <Button type="submit" size="lg">
          Start
        </Button>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>
    </form>
  );
}
