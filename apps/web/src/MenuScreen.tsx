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
  readonly onSettings: () => void;
  readonly onHelp: () => void;
}

/** The main menu, the `main` panel of the `menu` state: the title and the three ways out. */
export function MenuScreen({
  onPlay,
  onPreload,
  onSettings,
  onHelp,
}: MenuScreenProps): JSX.Element {
  const titleId = useId();
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
            <Button variant="secondary" onClick={onSettings}>
              {t.menu.settings}
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
