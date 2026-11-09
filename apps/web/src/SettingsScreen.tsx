import {
  Button,
  Inline,
  RadioGroup,
  type RadioOption,
  Slider,
  Stack,
  Switch,
  Tabs,
} from '@buzzkill/ui';
import { type JSX, useId } from 'react';

import type { Settings } from './state/settings';
import type { ThemeChoice } from './theme';

interface SettingsScreenProps {
  readonly settings: Settings;
  readonly onChange: (changes: Partial<Settings>) => void;
  readonly onBack: () => void;
}

const THEMES = [
  { value: 'system', label: 'Match the system' },
  { value: 'day', label: 'Always day' },
  { value: 'night', label: 'Always night' },
] as const satisfies readonly RadioOption<ThemeChoice>[];

const percent = (value: number): string => `${String(Math.round(value * 100))} %`;

/**
 * The `settings` panel of the menu: the sound and the display, one tab each. Every change goes to
 * the settings store at once, so the mixer and the theme follow while the player is still here.
 */
export function SettingsScreen({ settings, onChange, onBack }: SettingsScreenProps): JSX.Element {
  const titleId = useId();

  return (
    <section className="screen" aria-labelledby={titleId}>
      <Stack gap="xl" align="center">
        <h1 id={titleId}>Settings</h1>
        <Tabs
          label="Settings sections"
          items={[
            {
              value: 'sound',
              label: 'Sound',
              panel: (
                <Stack gap="lg">
                  <Switch
                    label="Sound"
                    checked={!settings.muted}
                    onCheckedChange={(on) => {
                      onChange({ muted: !on });
                    }}
                  />
                  <Slider
                    label="Effects volume"
                    min={0}
                    max={1}
                    step={0.1}
                    value={settings.effectsVolume}
                    onValueChange={(effectsVolume) => {
                      onChange({ effectsVolume });
                    }}
                    formatValue={percent}
                  />
                  <Slider
                    label="Music volume"
                    min={0}
                    max={1}
                    step={0.1}
                    value={settings.musicVolume}
                    onValueChange={(musicVolume) => {
                      onChange({ musicVolume });
                    }}
                    formatValue={percent}
                  />
                </Stack>
              ),
            },
            {
              value: 'display',
              label: 'Display',
              panel: (
                <RadioGroup
                  label="Theme"
                  name="theme"
                  orientation="vertical"
                  options={THEMES}
                  value={settings.theme}
                  onValueChange={(theme) => {
                    onChange({ theme });
                  }}
                />
              ),
            },
          ]}
        />
        <Inline justify="center">
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
        </Inline>
      </Stack>
    </section>
  );
}
