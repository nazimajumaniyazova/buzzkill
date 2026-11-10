import { Button, Inline, RadioGroup, Slider, Stack, Switch, Tabs } from '@buzzkill/ui';
import { type JSX, useId } from 'react';

import { labelled, LANGUAGE_NAMES, useI18n } from './i18n/i18n';
import { KeyBindingsEditor } from './KeyBindingsEditor';
import type { Difficulty, Language, Settings } from './state/settings/schema';
import type { ThemeChoice } from './theme';

interface SettingsScreenProps {
  readonly settings: Settings;
  readonly onChange: (changes: Partial<Settings>) => void;
  readonly onBack: () => void;
}

const THEMES = ['system', 'day', 'night'] as const satisfies readonly ThemeChoice[];
const LANGUAGES = ['en', 'ru'] as const satisfies readonly Language[];
const DIFFICULTIES = ['easy', 'normal', 'hard'] as const satisfies readonly Difficulty[];

/**
 * The `settings` panel of the menu, one tab per kind: sound, display, gameplay and controls.
 * Every change goes to the settings store at once, which saves it; the mixer, the theme and the
 * language follow while the player is still here, and the keys apply to the next run.
 */
export function SettingsScreen({ settings, onChange, onBack }: SettingsScreenProps): JSX.Element {
  const titleId = useId();
  const { t, format } = useI18n();

  return (
    <section className="screen" aria-labelledby={titleId}>
      <Stack gap="xl" align="center">
        <h1 id={titleId}>{t.settings.title}</h1>
        <Tabs
          label={t.settings.sections}
          items={[
            {
              value: 'sound',
              label: t.settings.tabs.sound,
              panel: (
                <Stack gap="lg">
                  <Switch
                    label={t.settings.sound}
                    checked={!settings.muted}
                    onCheckedChange={(on) => {
                      onChange({ muted: !on });
                    }}
                  />
                  <Slider
                    label={t.settings.effectsVolume}
                    min={0}
                    max={1}
                    step={0.1}
                    value={settings.effectsVolume}
                    onValueChange={(effectsVolume) => {
                      onChange({ effectsVolume });
                    }}
                    formatValue={format.percent}
                  />
                  <Slider
                    label={t.settings.musicVolume}
                    min={0}
                    max={1}
                    step={0.1}
                    value={settings.musicVolume}
                    onValueChange={(musicVolume) => {
                      onChange({ musicVolume });
                    }}
                    formatValue={format.percent}
                  />
                </Stack>
              ),
            },
            {
              value: 'display',
              label: t.settings.tabs.display,
              panel: (
                <Stack gap="lg">
                  <RadioGroup
                    label={t.settings.theme}
                    name="theme"
                    orientation="vertical"
                    options={labelled(THEMES, t.settings.themes)}
                    value={settings.theme}
                    onValueChange={(theme) => {
                      onChange({ theme });
                    }}
                  />
                  <RadioGroup
                    label={t.settings.language}
                    name="language"
                    options={labelled(LANGUAGES, LANGUAGE_NAMES)}
                    value={settings.language}
                    onValueChange={(language) => {
                      onChange({ language });
                    }}
                  />
                </Stack>
              ),
            },
            {
              value: 'gameplay',
              label: t.settings.tabs.gameplay,
              panel: (
                <RadioGroup
                  label={t.settings.difficulty}
                  name="difficulty"
                  options={labelled(DIFFICULTIES, t.settings.difficulties)}
                  value={settings.difficulty}
                  onValueChange={(difficulty) => {
                    onChange({ difficulty });
                  }}
                />
              ),
            },
            {
              value: 'controls',
              label: t.settings.tabs.controls,
              panel: (
                <KeyBindingsEditor
                  bindings={settings.keyBindings}
                  onChange={(keyBindings) => {
                    onChange({ keyBindings });
                  }}
                />
              ),
            },
          ]}
        />
        <Inline justify="center">
          <Button variant="secondary" onClick={onBack}>
            {t.common.back}
          </Button>
        </Inline>
      </Stack>
    </section>
  );
}
