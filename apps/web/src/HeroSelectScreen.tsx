import { DAILY_RUN, type GameMode, type HeroId } from '@buzzkill/game';
import { Button, Inline, RadioGroup, Stack } from '@buzzkill/ui';
import { type JSX, type SubmitEvent, useId, useState } from 'react';

import { labelled, useI18n } from './i18n/i18n';
import type { RunChoice } from './state/machine';

interface HeroSelectScreenProps {
  /** The UTC date of the daily run being set up (#165): then only the hero is chosen. */
  readonly daily?: string | null;
  readonly onStart: (choice: RunChoice) => void;
  readonly onBack: () => void;
}

const HEROES = ['male', 'female'] as const satisfies readonly HeroId[];
const MODES = ['day', 'night'] as const satisfies readonly GameMode[];

/**
 * The UTC date `YYYY-MM-DD` as a moment the language writes as that date in any time zone: noon of
 * that day, local time.
 */
function noonOf(date: string): Date {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

/**
 * The `heroSelect` state: the hero and the time of day, then Start. For the daily run (#165) the
 * day is the same for everyone, so only the hero is chosen, and the screen says what the run is.
 */
export function HeroSelectScreen({
  daily = null,
  onStart,
  onBack,
}: HeroSelectScreenProps): JSX.Element {
  const titleId = useId();
  const { t } = useI18n();
  const [heroId, setHeroId] = useState<HeroId>('male');
  const [mode, setMode] = useState<GameMode>('day');

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onStart({ heroId, mode: daily === null ? mode : DAILY_RUN.mode });
  };

  return (
    <form className="screen" aria-labelledby={titleId} onSubmit={handleSubmit}>
      <Stack gap="xl" align="center">
        <Stack gap="sm" align="center">
          <h1 id={titleId}>{daily === null ? t.heroSelect.title : t.heroSelect.dailyTitle}</h1>
          {daily !== null && <p>{t.heroSelect.dailyAbout(noonOf(daily))}</p>}
        </Stack>
        <Stack gap="lg" align="center">
          <RadioGroup
            label={t.heroSelect.hero}
            name="hero"
            options={labelled(HEROES, t.heroSelect.heroes)}
            value={heroId}
            onValueChange={setHeroId}
          />
          {daily === null && (
            <RadioGroup
              label={t.heroSelect.timeOfDay}
              name="mode"
              options={labelled(MODES, t.heroSelect.modes)}
              value={mode}
              onValueChange={setMode}
            />
          )}
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
