import type { GameMode, HeroId } from '@buzzkill/game';
import { Button, KeyHint, RadioGroup, type RadioOption, Slider } from '@buzzkill/ui';
import { type JSX, type SubmitEvent, useId, useState } from 'react';

import type { ThemeChoice } from './theme';

/** What the player picked on the start screen. */
export interface StartChoice {
  readonly heroId: HeroId;
  readonly mode: GameMode;
  /** Volume of the sound effects, from 0 (muted) to 1. */
  readonly volume: number;
}

interface StartScreenProps {
  /** The player's theme setting; a page setting, not part of the run, so it is controlled. */
  theme: ThemeChoice;
  onThemeChange: (theme: ThemeChoice) => void;
  onStart: (choice: StartChoice) => void;
}

const HEROES = [
  { value: 'male', label: 'Mike' },
  { value: 'female', label: 'Julie' },
] as const satisfies readonly RadioOption<HeroId>[];

const MODES = [
  { value: 'day', label: 'Day' },
  { value: 'night', label: 'Night' },
] as const satisfies readonly RadioOption<GameMode>[];

const THEMES = [
  { value: 'system', label: 'Match the system' },
  { value: 'day', label: 'Always day' },
  { value: 'night', label: 'Always night' },
] as const satisfies readonly RadioOption<ThemeChoice>[];

const percent = (value: number): string => `${String(Math.round(value * 100))} %`;

/**
 * Plain, keyboard-reachable start screen: hero, time of day, volume and theme, then Play. The
 * design-system version with the menu state machine replaces it in stage 5.
 */
export function StartScreen({ theme, onThemeChange, onStart }: StartScreenProps): JSX.Element {
  const titleId = useId();
  const [hero, setHero] = useState<HeroId>('male');
  const [mode, setMode] = useState<GameMode>('day');
  const [volume, setVolume] = useState(0.3);

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onStart({ heroId: hero, mode, volume });
  };

  return (
    <form className="start-screen" aria-labelledby={titleId} onSubmit={handleSubmit}>
      <h1 id={titleId}>Buzzkill</h1>
      <p>The year is 3023. Giant insects from outer space attack the city. Shoot them down.</p>

      <RadioGroup label="Hero" name="hero" options={HEROES} value={hero} onValueChange={setHero} />
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

      <Button type="submit" size="lg">
        Play
      </Button>
    </form>
  );
}
