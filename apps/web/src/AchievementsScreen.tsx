import { type AchievementProgress, ACHIEVEMENTS } from '@buzzkill/game';
import { Button, Stack } from '@buzzkill/ui';
import { type JSX, useId } from 'react';

import { useI18n } from './i18n/i18n';

interface AchievementsScreenProps {
  /** The progress kept on this device (#163). */
  readonly progress: AchievementProgress;
  readonly onBack: () => void;
}

/**
 * The `achievements` panel of the menu (#163): every achievement with what it asks, a bar of the
 * progress toward it named by the achievement, the count in words, and whether it is earned.
 */
export function AchievementsScreen({ progress, onBack }: AchievementsScreenProps): JSX.Element {
  const titleId = useId();
  const { t } = useI18n();

  return (
    <section className="screen" aria-labelledby={titleId}>
      <Stack gap="xl" align="center">
        <Stack gap="sm" align="center">
          <h1 id={titleId}>{t.achievements.title}</h1>
          <p>{t.achievements.intro}</p>
        </Stack>
        <ul className="achievements">
          {ACHIEVEMENTS.map(({ id, goal }) => {
            const { name, description } = t.achievements.items[id];
            const count = progress[id];
            const nameId = `${titleId}-${id}`;
            return (
              <li key={id} data-earned={count >= goal}>
                <h2 id={nameId}>{name}</h2>
                <p>{description(goal)}</p>
                <progress aria-labelledby={nameId} value={count} max={goal} />
                <p>
                  {count >= goal ? t.achievements.earned : t.achievements.progress(count, goal)}
                </p>
              </li>
            );
          })}
        </ul>
        <Button variant="secondary" onClick={onBack}>
          {t.common.back}
        </Button>
      </Stack>
    </section>
  );
}
