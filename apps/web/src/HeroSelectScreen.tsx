import type { GameMode, HeroId } from '@buzzkill/game';
import { Button, Inline, RadioGroup, type RadioOption, Stack } from '@buzzkill/ui';
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

/** The `heroSelect` state: the hero and the time of day, then Start. */
export function HeroSelectScreen({ onStart, onBack }: HeroSelectScreenProps): JSX.Element {
  const titleId = useId();
  const [heroId, setHeroId] = useState<HeroId>('male');
  const [mode, setMode] = useState<GameMode>('day');

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onStart({ heroId, mode });
  };

  return (
    <form className="screen" aria-labelledby={titleId} onSubmit={handleSubmit}>
      <Stack gap="xl" align="center">
        <h1 id={titleId}>Choose your hero</h1>
        <Stack gap="lg" align="center">
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
        </Stack>
        <Inline gap="lg" justify="center">
          <Button type="submit" size="lg">
            Start
          </Button>
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
        </Inline>
      </Stack>
    </form>
  );
}
