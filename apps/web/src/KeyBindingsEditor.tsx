import type { KeyBindings } from '@buzzkill/engine';
import { DEFAULT_KEY_BINDINGS, GAME_ACTIONS, type GameAction } from '@buzzkill/game';
import { Button, Inline, Stack } from '@buzzkill/ui';
import { type JSX, useEffect, useState } from 'react';

import { ACTION_LABELS, KeyCap, keyName } from './controls';
import { remapKey } from './state/settings/bindings';
import { KEYS_PER_ACTION } from './state/settings/schema';

interface KeyBindingsEditorProps {
  readonly bindings: KeyBindings<GameAction>;
  readonly onChange: (bindings: KeyBindings<GameAction>) => void;
}

interface Slot {
  readonly action: GameAction;
  readonly slot: number;
}

const SLOTS = Array.from({ length: KEYS_PER_ACTION }, (_, slot) => slot);

/**
 * The keyboard controls, two keys per action. Activating a key waits for the next key press and
 * binds it; Escape cancels and Tab moves on. A key that another action holds swaps places with
 * the old one (`remapKey`), and the status line says which action moved, so a conflict is never
 * silent and never leaves an action without keys.
 */
export function KeyBindingsEditor({ bindings, onChange }: KeyBindingsEditorProps): JSX.Element {
  const [waiting, setWaiting] = useState<Slot | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (waiting === null) {
      return;
    }
    // On the window in the capture phase, ahead of every other listener: the key is the
    // answer to the question, not a command for the page (Escape would leave the screen).
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === 'Tab') {
        setWaiting(null);
        setMessage('');
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (event.code === 'Escape' || event.code === '') {
        setWaiting(null);
        setMessage('No change.');
        return;
      }
      const { action, slot } = waiting;
      const result = remapKey(bindings, action, slot, event.code);
      if (result.bindings !== bindings) {
        onChange(result.bindings);
      }
      const label = ACTION_LABELS[action];
      const name = keyName(event.code);
      const moved =
        result.displaced === null
          ? ''
          : ` ${name} was taken from ${ACTION_LABELS[result.displaced.action]}, which now uses ${keyName(result.displaced.code)}.`;
      setWaiting(null);
      setMessage(`${label} now uses ${name}.${moved}`);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [waiting, bindings, onChange]);

  return (
    <Stack gap="md">
      <table className="bindings">
        <caption>Keyboard</caption>
        <thead>
          <tr>
            <th scope="col">Action</th>
            {SLOTS.map((slot) => (
              <th key={slot} scope="col">
                Key {slot + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GAME_ACTIONS.map((action) => (
            <tr key={action}>
              <th scope="row">{ACTION_LABELS[action]}</th>
              {SLOTS.map((slot) => {
                const code = bindings[action][slot] ?? '';
                const isWaiting = waiting?.action === action && waiting.slot === slot;
                const label = `${ACTION_LABELS[action]}, key ${String(slot + 1)}`;
                return (
                  <td key={slot}>
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`${label}: ${isWaiting ? 'waiting for a key' : keyName(code)}`}
                      onClick={() => {
                        setWaiting({ action, slot });
                        setMessage(
                          `Press a key for ${ACTION_LABELS[action]}, or Escape to cancel.`,
                        );
                      }}
                      onBlur={() => {
                        if (isWaiting) {
                          setWaiting(null);
                        }
                      }}
                    >
                      {isWaiting ? 'Press a key…' : <KeyCap code={code} />}
                    </Button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p role="status">{message}</p>
      <Inline>
        <Button
          variant="secondary"
          onClick={() => {
            setWaiting(null);
            onChange(DEFAULT_KEY_BINDINGS);
            setMessage('The default keys are back.');
          }}
        >
          Reset keys
        </Button>
      </Inline>
    </Stack>
  );
}
