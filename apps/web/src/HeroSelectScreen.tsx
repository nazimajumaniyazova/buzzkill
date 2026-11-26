import {
  type AchievementProgress,
  ACHIEVEMENTS,
  DAILY_RUN,
  type GameMode,
  type HeroConfig,
  HEROES,
  type HeroId,
  heroUnlocked,
} from '@buzzkill/game';
import { Button, Inline, RadioGroup, type RadioOption, Stack } from '@buzzkill/ui';
import { type JSX, type SubmitEvent, useId, useState } from 'react';

import { noonOf } from './i18n/format';
import { labelled, useI18n } from './i18n/i18n';
import type { RunChoice } from './state/machine';

interface HeroSelectScreenProps {
  /** The UTC date of the daily run being set up (#165): then only the hero is chosen. */
  readonly daily?: string | null;
  /** The achievements of this device, which unlock the heroes after the first two (#164). */
  readonly progress: AchievementProgress;
  readonly onStart: (choice: RunChoice) => void;
  readonly onBack: () => void;
}

// The keys of the configuration are the hero ids, in the order the screen lists them.
const HERO_IDS = Object.keys(HEROES) as HeroId[];
const MODES = ['day', 'night'] as const satisfies readonly GameMode[];

/**
 * The `heroSelect` state: the hero and the time of day, then Start. For the daily run (#165) the
 * day is the same for everyone, so only the hero is chosen, and the screen says what the run is.
 * A hero an achievement unlocks (#164) is listed from the start, disabled until it is earned, with
 * the achievement under its name.
 */
export function HeroSelectScreen({
  daily = null,
  progress,
  onStart,
  onBack,
}: HeroSelectScreenProps): JSX.Element {
  const titleId = useId();
  const { t } = useI18n();
  const [heroId, setHeroId] = useState<HeroId>('male');
  const [mode, setMode] = useState<GameMode>('day');

  const heroes = HERO_IDS.map((id): RadioOption<HeroId> => {
    const label = t.heroSelect.heroes[id];
    const { unlockedBy }: HeroConfig = HEROES[id];
    if (unlockedBy === undefined || heroUnlocked(id, progress)) {
      return { value: id, label };
    }
    const goal = ACHIEVEMENTS.find((achievement) => achievement.id === unlockedBy)?.goal ?? 1;
    const achievement = t.achievements.items[unlockedBy];
    return {
      value: id,
      label,
      disabled: true,
      description: t.heroSelect.locked(achievement.name, achievement.description(goal)),
    };
  });

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
            options={heroes}
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
