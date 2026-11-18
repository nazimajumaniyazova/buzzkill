import { Button, Stack } from '@buzzkill/ui';
import { type JSX, useId } from 'react';

import { useI18n } from './i18n/i18n';

interface MenuScreenProps {
  readonly onPlay: () => void;
  /**
   * The player is about to choose Play: the pointer is over it or it has focus. The game starts
   * loading then (#112), so it is often ready by the time the hero is chosen.
   */
  readonly onPreload: () => void;
  /** Starts setting up today's daily challenge (#165). */
  readonly onDaily: () => void;
  /** This device's best score in today's daily challenge, or `null` before one. */
  readonly dailyBest: number | null;
  readonly onSettings: () => void;
  /** Opens the list of achievements (#163). */
  readonly onAchievements: () => void;
  readonly onHelp: () => void;
}

/**
 * The main menu, the `main` panel of the `menu` state: the title and the ways out, the daily
 * challenge with this device's best score of the day as its description.
 */
export function MenuScreen({
  onPlay,
  onPreload,
  onDaily,
  dailyBest,
  onSettings,
  onAchievements,
  onHelp,
}: MenuScreenProps): JSX.Element {
  const titleId = useId();
  const dailyId = useId();
  const { t } = useI18n();

  return (
    <section className="screen" aria-labelledby={titleId}>
      <Stack gap="xl" align="center">
        <Stack gap="sm" align="center">
          <h1 id={titleId}>{t.menu.title}</h1>
          <p>{t.menu.tagline}</p>
        </Stack>
        <nav aria-label={t.menu.navigation}>
          <Stack gap="md" align="stretch">
            <Button size="lg" onClick={onPlay} onPointerEnter={onPreload} onFocus={onPreload}>
              {t.menu.play}
            </Button>
            <Button
              variant="secondary"
              aria-describedby={dailyId}
              onClick={onDaily}
              onPointerEnter={onPreload}
              onFocus={onPreload}
            >
              {t.menu.daily}
            </Button>
            <p id={dailyId} className="menu-note">
              {dailyBest === null ? t.menu.dailyNotPlayed : t.menu.dailyBest(dailyBest)}
            </p>
            <Button variant="secondary" onClick={onSettings}>
              {t.menu.settings}
            </Button>
            <Button variant="secondary" onClick={onAchievements}>
              {t.menu.achievements}
            </Button>
            <Button variant="secondary" onClick={onHelp}>
              {t.menu.help}
            </Button>
          </Stack>
        </nav>
      </Stack>
    </section>
  );
}
