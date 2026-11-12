import type { KeyBindings } from '@buzzkill/engine';
import { DEFAULT_GAMEPAD_BINDINGS, GAME_ACTIONS, type GameAction } from '@buzzkill/game';
import { Button, Inline, KeyHint, Stack } from '@buzzkill/ui';
import { Fragment, type JSX, useId } from 'react';

import { KeyCap } from './controls';
import type { Messages } from './i18n/en';
import { useI18n } from './i18n/i18n';

interface HelpScreenProps {
  /** The player's keys, from the settings. */
  readonly keyBindings: KeyBindings<GameAction>;
  /** The hero's lives at the difficulty of the settings (#155). */
  readonly lives: number;
  readonly onBack: () => void;
}

/** The buttons of the W3C standard gamepad mapping that the game and the menus use. */
const PAD_BUTTONS: Readonly<Partial<Record<number, keyof Messages['help']['padButtons']>>> = {
  0: 'a',
  1: 'b',
  9: 'start',
  12: 'dpadUp',
  13: 'dpadDown',
  14: 'dpadLeft',
  15: 'dpadRight',
};

/** A gamepad button by its index in the standard mapping. */
function PadCap({ button }: { readonly button: number }): JSX.Element {
  const { t } = useI18n();
  const name = PAD_BUTTONS[button];
  return (
    <KeyHint kind="gamepad">
      {name === undefined ? t.help.padButton(button) : t.help.padButtons[name]}
    </KeyHint>
  );
}

/** The caps of one action, separated by "or" in the current language. */
function alternatives(caps: readonly JSX.Element[], or: string): JSX.Element[] {
  return caps.map((cap, index) => (
    <Fragment key={index}>
      {index > 0 && ` ${or} `}
      {cap}
    </Fragment>
  ));
}

/**
 * The `help` panel of the menu: the keyboard controls from the player's own bindings and the
 * gamepad controls from the game's, so the page cannot drift from either, and the controls of
 * the menus.
 */
export function HelpScreen({ keyBindings, lives, onBack }: HelpScreenProps): JSX.Element {
  const titleId = useId();
  const { t } = useI18n();

  return (
    <section className="screen" aria-labelledby={titleId}>
      <Stack gap="xl" align="center">
        <Stack gap="sm" align="center">
          <h1 id={titleId}>{t.help.title}</h1>
          <p>{t.help.intro(lives)}</p>
        </Stack>
        <Stack gap="lg">
          <section aria-labelledby={`${titleId}-keyboard`}>
            <h2 id={`${titleId}-keyboard`}>{t.help.keyboard}</h2>
            <dl className="controls">
              {GAME_ACTIONS.map((action) => (
                <div key={action}>
                  <dt>{t.actions[action]}</dt>
                  <dd>
                    {alternatives(
                      keyBindings[action].map((code) => <KeyCap key={code} code={code} />),
                      t.help.or,
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <section aria-labelledby={`${titleId}-gamepad`}>
            <h2 id={`${titleId}-gamepad`}>{t.help.gamepad}</h2>
            <dl className="controls">
              {GAME_ACTIONS.map((action) => {
                const buttons = DEFAULT_GAMEPAD_BINDINGS.buttons[action].map((button) => (
                  <PadCap key={button} button={button} />
                ));
                const stick =
                  action in DEFAULT_GAMEPAD_BINDINGS.axes ? (
                    <KeyHint kind="gamepad">{t.help.leftStick}</KeyHint>
                  ) : null;
                return (
                  <div key={action}>
                    <dt>{t.actions[action]}</dt>
                    <dd>
                      {alternatives(stick === null ? buttons : [...buttons, stick], t.help.or)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
          <section aria-labelledby={`${titleId}-menus`}>
            <h2 id={`${titleId}-menus`}>{t.help.menus}</h2>
            <dl className="controls">
              <div>
                <dt>{t.help.move}</dt>
                <dd>
                  {alternatives(
                    [
                      <KeyCap key="tab" code="Tab" />,
                      <KeyHint key="arrows" symbol="↑↓←→">
                        {t.help.arrowKeys}
                      </KeyHint>,
                      <KeyHint key="dpad" kind="gamepad">
                        {t.help.dpad}
                      </KeyHint>,
                      <KeyHint key="stick" kind="gamepad">
                        {t.help.leftStick}
                      </KeyHint>,
                    ],
                    t.help.or,
                  )}
                </dd>
              </div>
              <div>
                <dt>{t.help.select}</dt>
                <dd>
                  {alternatives(
                    [<KeyCap key="enter" code="Enter" />, <PadCap key="a" button={0} />],
                    t.help.or,
                  )}
                </dd>
              </div>
              <div>
                <dt>{t.help.goBack}</dt>
                <dd>
                  {alternatives(
                    [<KeyCap key="escape" code="Escape" />, <PadCap key="b" button={1} />],
                    t.help.or,
                  )}
                </dd>
              </div>
            </dl>
          </section>
        </Stack>
        <Inline justify="center">
          <Button variant="secondary" onClick={onBack}>
            {t.common.back}
          </Button>
        </Inline>
      </Stack>
    </section>
  );
}
