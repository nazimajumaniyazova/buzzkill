import {
  DEFAULT_GAMEPAD_BINDINGS,
  DEFAULT_KEY_BINDINGS,
  GAME_ACTIONS,
  type GameAction,
} from '@buzzkill/game';
import { Button, Inline, KeyHint, Stack } from '@buzzkill/ui';
import { Fragment, type JSX, useId } from 'react';

interface HelpScreenProps {
  readonly onBack: () => void;
}

const ACTION_LABELS: Readonly<Record<GameAction, string>> = {
  moveUp: 'Move up',
  moveDown: 'Move down',
  fire: 'Shoot',
  pause: 'Pause',
};

/** How a `KeyboardEvent.code` is called and printed; other codes print their name. */
const KEY_CAPS: Readonly<Record<string, { readonly name: string; readonly symbol?: string }>> = {
  ArrowUp: { name: 'Arrow up', symbol: '↑' },
  ArrowDown: { name: 'Arrow down', symbol: '↓' },
  ArrowLeft: { name: 'Arrow left', symbol: '←' },
  ArrowRight: { name: 'Arrow right', symbol: '→' },
  Space: { name: 'Space' },
  Escape: { name: 'Escape', symbol: 'Esc' },
  Enter: { name: 'Enter' },
};

/** The buttons of the W3C standard gamepad mapping the game and the menus use. */
const BUTTON_NAMES: Readonly<Record<number, string>> = {
  0: 'A',
  1: 'B',
  9: 'Start',
  12: 'D-pad up',
  13: 'D-pad down',
  14: 'D-pad left',
  15: 'D-pad right',
};

function keyCap(code: string): JSX.Element {
  const cap = KEY_CAPS[code] ?? { name: code.replace(/^Key/, '') };
  return cap.symbol === undefined ? (
    <KeyHint>{cap.name}</KeyHint>
  ) : (
    <KeyHint symbol={cap.symbol}>{cap.name}</KeyHint>
  );
}

function padCap(button: number): JSX.Element {
  return <KeyHint kind="gamepad">{BUTTON_NAMES[button] ?? `Button ${String(button)}`}</KeyHint>;
}

/** The caps of one action, separated by "or". */
function alternatives(caps: readonly JSX.Element[]): JSX.Element[] {
  return caps.map((cap, index) => (
    <Fragment key={index}>
      {index > 0 && ' or '}
      {cap}
    </Fragment>
  ));
}

/**
 * The `help` panel of the menu: the controls of the game from its default bindings, so the page
 * cannot drift from them, and the controls of the menus.
 */
export function HelpScreen({ onBack }: HelpScreenProps): JSX.Element {
  const titleId = useId();

  return (
    <section className="screen" aria-labelledby={titleId}>
      <Stack gap="xl" align="center">
        <Stack gap="sm" align="center">
          <h1 id={titleId}>Help</h1>
          <p>Shoot the insects before they reach the city. Five hits and the run is over.</p>
        </Stack>
        <Stack gap="lg">
          <section aria-labelledby={`${titleId}-keyboard`}>
            <h2 id={`${titleId}-keyboard`}>Keyboard</h2>
            <dl className="controls">
              {GAME_ACTIONS.map((action) => (
                <div key={action}>
                  <dt>{ACTION_LABELS[action]}</dt>
                  <dd>{alternatives(DEFAULT_KEY_BINDINGS[action].map(keyCap))}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section aria-labelledby={`${titleId}-gamepad`}>
            <h2 id={`${titleId}-gamepad`}>Gamepad</h2>
            <dl className="controls">
              {GAME_ACTIONS.map((action) => {
                const buttons = DEFAULT_GAMEPAD_BINDINGS.buttons[action].map(padCap);
                const stick =
                  action in DEFAULT_GAMEPAD_BINDINGS.axes ? (
                    <KeyHint kind="gamepad">Left stick</KeyHint>
                  ) : null;
                return (
                  <div key={action}>
                    <dt>{ACTION_LABELS[action]}</dt>
                    <dd>{alternatives(stick === null ? buttons : [...buttons, stick])}</dd>
                  </div>
                );
              })}
            </dl>
          </section>
          <section aria-labelledby={`${titleId}-menus`}>
            <h2 id={`${titleId}-menus`}>In the menus</h2>
            <p>
              <KeyHint>Tab</KeyHint> and the arrow keys move, <KeyHint>Enter</KeyHint> selects,{' '}
              <KeyHint symbol="Esc">Escape</KeyHint> closes a dialog. On a gamepad, the D-pad or the
              left stick moves, <KeyHint kind="gamepad">A</KeyHint> selects and{' '}
              <KeyHint kind="gamepad">B</KeyHint> goes back.
            </p>
          </section>
        </Stack>
        <Inline justify="center">
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
        </Inline>
      </Stack>
    </section>
  );
}
