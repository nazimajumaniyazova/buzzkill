import type { GameMode, HeroId } from '@buzzkill/game';
import { Button, Inline, RadioGroup, Stack } from '@buzzkill/ui';
import { type JSX, type SubmitEvent, useId, useState } from 'react';

import { labelled, useI18n } from './i18n/i18n';
import type { RunChoice } from './state/machine';

interface HeroSelectScreenProps {
  readonly onStart: (choice: RunChoice) => void;
  readonly onBack: () => void;
}

const HEROES = ['male', 'female'] as const satisfies readonly HeroId[];
const MODES = ['day', 'night'] as const satisfies readonly GameMode[];

/** The `heroSelect` state: the hero and the time of day, then Start. */
export function HeroSelectScreen({ onStart, onBack }: HeroSelectScreenProps): JSX.Element {
  const titleId = useId();
  const { t } = useI18n();
  const [heroId, setHeroId] = useState<HeroId>('male');
  const [mode, setMode] = useState<GameMode>('day');

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onStart({ heroId, mode });
  };

  return (
    <form className="screen" aria-labelledby={titleId} onSubmit={handleSubmit}>
      <Stack gap="xl" align="center">
        <h1 id={titleId}>{t.heroSelect.title}</h1>
        <Stack gap="lg" align="center">
          <RadioGroup
            label={t.heroSelect.hero}
            name="hero"
            options={labelled(HEROES, t.heroSelect.heroes)}
            value={heroId}
            onValueChange={setHeroId}
          />
          <RadioGroup
            label={t.heroSelect.timeOfDay}
            name="mode"
            options={labelled(MODES, t.heroSelect.modes)}
            value={mode}
            onValueChange={setMode}
          />
        </Stack>
        <Inline gap="lg" justify="center">
          <Button type="submit" size="lg">
            {t.heroSelect.start}
          </Button>
          <Button variant="secondary" onClick={onBack}>
            {t.common.back}
          </Button>
        </Inline>
      </Stack>
    </form>
  );
}
