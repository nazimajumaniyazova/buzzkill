import { Button, KeyHint, RadioGroup, type RadioOption } from '@buzzkill/ui';
import { type JSX, useId } from 'react';

import type { ThemeChoice } from './theme';

interface MenuScreenProps {
  /** The player's theme setting; a page setting, not part of a run, so it is controlled. */
  readonly theme: ThemeChoice;
  readonly onThemeChange: (theme: ThemeChoice) => void;
  readonly onPlay: () => void;
}

const THEMES = [
  { value: 'system', label: 'Match the system' },
  { value: 'day', label: 'Always day' },
  { value: 'night', label: 'Always night' },
] as const satisfies readonly RadioOption<ThemeChoice>[];

/**
 * The main menu of the `menu` state: the title, Play, the theme and the controls. Plain and
 * keyboard-reachable; the design-system version with settings and help arrives with #108.
 */
export function MenuScreen({ theme, onThemeChange, onPlay }: MenuScreenProps): JSX.Element {
  const titleId = useId();

  return (
    <section className="start-screen" aria-labelledby={titleId}>
      <h1 id={titleId}>Buzzkill</h1>
      <p>The year is 3023. Giant insects from outer space attack the city. Shoot them down.</p>

      <Button size="lg" onClick={onPlay}>
        Play
      </Button>

      <RadioGroup
        label="Theme"
        name="theme"
        options={THEMES}
        value={theme}
        onValueChange={onThemeChange}
      />

      <p>
        Controls: <KeyHint symbol="↑">Arrow up</KeyHint> and{' '}
        <KeyHint symbol="↓">Arrow down</KeyHint> to move, <KeyHint>Space</KeyHint> to shoot,{' '}
        <KeyHint>Escape</KeyHint> to pause.
      </p>
    </section>
  );
}
