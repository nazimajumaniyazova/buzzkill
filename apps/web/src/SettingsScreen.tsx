import { DIFFICULTY_IDS } from '@buzzkill/game';
import { Button, Inline, RadioGroup, Slider, Stack, Switch, Tabs } from '@buzzkill/ui';
import { type JSX, useId } from 'react';

import { labelled, LANGUAGE_NAMES, useI18n } from './i18n/i18n';
import { KeyBindingsEditor } from './KeyBindingsEditor';
import type { MotionChoice } from './motion';
import { GAME_SPEEDS, type Language, type Settings } from './state/settings/schema';
import type { ThemeChoice } from './theme';

interface SettingsScreenProps {
  readonly settings: Settings;
  readonly onChange: (changes: Partial<Settings>) => void;
  readonly onBack: () => void;
  /** Whether the device can vibrate (#162); the vibration switch is shown only then. */
  readonly canVibrate?: boolean;
}

const THEMES = ['system', 'day', 'night'] as const satisfies readonly ThemeChoice[];
const LANGUAGES = ['en', 'ru'] as const satisfies readonly Language[];
const MOTIONS = ['system', 'reduced', 'full'] as const satisfies readonly MotionChoice[];

/**
 * The `settings` panel of the menu, one tab per kind: sound, display, gameplay, effects and
 * controls. Every change goes to the settings store at once, which saves it; the mixer, the theme
 * and the language follow while the player is still here, the effects apply to the run on screen,
 * and the keys to the next run. The effects of stage 7 join the particles in their tab (#156); the
 * vibration among them only where the device can vibrate (#162).
 */
export function SettingsScreen({
  settings,
  onChange,
  onBack,
  canVibrate = false,
}: SettingsScreenProps): JSX.Element {
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
                    label={t.settings.motion}
                    name="motion"
                    orientation="vertical"
                    options={labelled(MOTIONS, t.settings.motions)}
                    value={settings.motion}
                    onValueChange={(motion) => {
                      onChange({ motion });
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
                <Stack gap="lg">
                  <RadioGroup
                    label={t.settings.difficulty}
                    name="difficulty"
                    options={labelled(DIFFICULTY_IDS, t.settings.difficulties)}
                    value={settings.difficulty}
                    onValueChange={(difficulty) => {
                      onChange({ difficulty });
                    }}
                  />
                  <Stack gap="sm">
                    {/* The radios hold strings; the setting is the number they name. */}
                    <RadioGroup
                      label={t.settings.gameSpeed}
                      name="gameSpeed"
                      options={GAME_SPEEDS.map((speed) => ({
                        value: String(speed),
                        label: format.percent(speed),
                      }))}
                      value={String(settings.gameSpeed)}
                      onValueChange={(value) => {
                        const gameSpeed = GAME_SPEEDS.find((speed) => String(speed) === value);
                        if (gameSpeed !== undefined) {
                          onChange({ gameSpeed });
                        }
                      }}
                    />
                    <p>{t.settings.gameSpeedHint}</p>
                  </Stack>
                </Stack>
              ),
            },
            {
              value: 'effects',
              label: t.settings.tabs.effects,
              panel: (
                <Stack gap="lg">
                  <EffectSwitch
                    label={t.settings.particles}
                    hint={t.settings.particlesHint}
                    checked={settings.particles}
                    onCheckedChange={(particles) => {
                      onChange({ particles });
                    }}
                  />
                  <EffectSwitch
                    label={t.settings.screenShake}
                    hint={t.settings.screenShakeHint}
                    checked={settings.screenShake}
                    onCheckedChange={(screenShake) => {
                      onChange({ screenShake });
                    }}
                  />
                  <EffectSwitch
                    label={t.settings.hitFlash}
                    hint={t.settings.hitFlashHint}
                    checked={settings.hitFlash}
                    onCheckedChange={(hitFlash) => {
                      onChange({ hitFlash });
                    }}
                  />
                  <EffectSwitch
                    label={t.settings.squashStretch}
                    hint={t.settings.squashStretchHint}
                    checked={settings.squashStretch}
                    onCheckedChange={(squashStretch) => {
                      onChange({ squashStretch });
                    }}
                  />
                  <EffectSwitch
                    label={t.settings.hitStop}
                    hint={t.settings.hitStopHint}
                    checked={settings.hitStop}
                    onCheckedChange={(hitStop) => {
                      onChange({ hitStop });
                    }}
                  />
                  {canVibrate && (
                    <EffectSwitch
                      label={t.settings.vibration}
                      hint={t.settings.vibrationHint}
                      checked={settings.vibration}
                      onCheckedChange={(vibration) => {
                        onChange({ vibration });
                      }}
                    />
                  )}
                </Stack>
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

interface EffectSwitchProps {
  readonly label: string;
  /** What the effect does, read out as the switch's description. */
  readonly hint: string;
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
}

/** One effect of the Effects tab: its switch, and below it what it does. */
function EffectSwitch({ label, hint, checked, onCheckedChange }: EffectSwitchProps): JSX.Element {
  const hintId = useId();
  return (
    <Stack gap="sm">
      <Switch
        label={label}
        aria-describedby={hintId}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
      <p id={hintId}>{hint}</p>
    </Stack>
  );
}
