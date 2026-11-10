import type { KeyBindings } from '@buzzkill/engine';
import { DEFAULT_KEY_BINDINGS, GAME_ACTIONS, type GameAction } from '@buzzkill/game';
import { Button, Inline, Stack } from '@buzzkill/ui';
import { type JSX, useEffect, useState } from 'react';

import { KeyCap, keyName } from './controls';
import type { Messages } from './i18n/en';
import { useI18n } from './i18n/i18n';
import { remapKey, type RemapResult } from './state/settings/bindings';
import { KEYS_PER_ACTION } from './state/settings/schema';

interface KeyBindingsEditorProps {
  readonly bindings: KeyBindings<GameAction>;
  readonly onChange: (bindings: KeyBindings<GameAction>) => void;
}

interface Slot {
  readonly action: GameAction;
  readonly slot: number;
}

/** What the status line says, kept as data so that it follows a change of the language. */
type Notice =
  | { readonly kind: 'prompt'; readonly action: GameAction }
  | { readonly kind: 'cancelled' }
  | {
      readonly kind: 'bound';
      readonly action: GameAction;
      readonly code: string;
      readonly displaced: RemapResult['displaced'];
    }
  | { readonly kind: 'reset' };

function noticeText(notice: Notice | null, t: Messages): string {
  if (notice === null) {
    return '';
  }
  switch (notice.kind) {
    case 'prompt':
      return t.keyEditor.prompt(t.actions[notice.action]);
    case 'cancelled':
      return t.keyEditor.cancelled;
    case 'reset':
      return t.keyEditor.resetDone;
    case 'bound': {
      const key = keyName(notice.code, t.keys);
      const bound = t.keyEditor.bound({ action: t.actions[notice.action], key });
      if (notice.displaced === null) {
        return bound;
      }
      const moved = t.keyEditor.displaced({
        key,
        action: t.actions[notice.displaced.action],
        newKey: keyName(notice.displaced.code, t.keys),
      });
      return `${bound} ${moved}`;
    }
  }
}

const SLOTS = Array.from({ length: KEYS_PER_ACTION }, (_, slot) => slot);

/**
 * The keyboard controls, two keys per action. Activating a key waits for the next key press and
 * binds it; Escape cancels and Tab moves on. A key that another action holds swaps places with
 * the old one (`remapKey`), and the status line says which action moved, so a conflict is never
 * silent and never leaves an action without keys.
 */
export function KeyBindingsEditor({ bindings, onChange }: KeyBindingsEditorProps): JSX.Element {
  const { t } = useI18n();
  const [waiting, setWaiting] = useState<Slot | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (waiting === null) {
      return;
    }
    // On the window in the capture phase, ahead of every other listener: the key is the
    // answer to the question, not a command for the page (Escape would leave the screen).
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === 'Tab') {
        setWaiting(null);
        setNotice(null);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (event.code === 'Escape' || event.code === '') {
        setWaiting(null);
        setNotice({ kind: 'cancelled' });
        return;
      }
      const { action, slot } = waiting;
      const result = remapKey(bindings, action, slot, event.code);
      if (result.bindings !== bindings) {
        onChange(result.bindings);
      }
      setWaiting(null);
      setNotice({ kind: 'bound', action, code: event.code, displaced: result.displaced });
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [waiting, bindings, onChange]);

  return (
    <Stack gap="md">
      <table className="bindings">
        <caption>{t.keyEditor.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t.keyEditor.action}</th>
            {SLOTS.map((slot) => (
              <th key={slot} scope="col">
                {t.keyEditor.slot(slot + 1)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GAME_ACTIONS.map((action) => (
            <tr key={action}>
              <th scope="row">{t.actions[action]}</th>
              {SLOTS.map((slot) => {
                const code = bindings[action][slot] ?? '';
                const isWaiting = waiting?.action === action && waiting.slot === slot;
                return (
                  <td key={slot}>
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={t.keyEditor.button({
                        action: t.actions[action],
                        slot: slot + 1,
                        key: isWaiting ? t.keyEditor.waitingName : keyName(code, t.keys),
                      })}
                      onClick={() => {
                        setWaiting({ action, slot });
                        setNotice({ kind: 'prompt', action });
                      }}
                      onBlur={() => {
                        if (isWaiting) {
                          setWaiting(null);
                        }
                      }}
                    >
                      {isWaiting ? t.keyEditor.waiting : <KeyCap code={code} />}
                    </Button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p role="status">{noticeText(notice, t)}</p>
      <Inline>
        <Button
          variant="secondary"
          onClick={() => {
            setWaiting(null);
            onChange(DEFAULT_KEY_BINDINGS);
            setNotice({ kind: 'reset' });
          }}
        >
          {t.keyEditor.reset}
        </Button>
      </Inline>
    </Stack>
  );
}
