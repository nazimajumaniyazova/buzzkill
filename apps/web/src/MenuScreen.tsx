import { Button, Stack } from '@buzzkill/ui';
import { type JSX, useId } from 'react';

interface MenuScreenProps {
  readonly onPlay: () => void;
  readonly onSettings: () => void;
  readonly onHelp: () => void;
}

/** The main menu, the `main` panel of the `menu` state: the title and the three ways out. */
export function MenuScreen({ onPlay, onSettings, onHelp }: MenuScreenProps): JSX.Element {
  const titleId = useId();

  return (
    <section className="screen" aria-labelledby={titleId}>
      <Stack gap="xl" align="center">
        <Stack gap="sm" align="center">
          <h1 id={titleId}>Buzzkill</h1>
          <p>The year is 3023. Giant insects from outer space attack the city. Shoot them down.</p>
        </Stack>
        <nav aria-label="Main menu">
          <Stack gap="md" align="stretch">
            <Button size="lg" onClick={onPlay}>
              Play
            </Button>
            <Button variant="secondary" onClick={onSettings}>
              Settings
            </Button>
            <Button variant="secondary" onClick={onHelp}>
              Help
            </Button>
          </Stack>
        </nav>
      </Stack>
    </section>
  );
}
