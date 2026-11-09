import type { GameAction } from '@buzzkill/game';
import { KeyHint } from '@buzzkill/ui';
import type { JSX } from 'react';

/** What the player reads for each action of the game. */
export const ACTION_LABELS: Readonly<Record<GameAction, string>> = {
  moveUp: 'Move up',
  moveDown: 'Move down',
  fire: 'Shoot',
  pause: 'Pause',
};

/** How a `KeyboardEvent.code` is called and printed, where its code is not the name. */
const KEY_CAPS: Readonly<Record<string, { readonly name: string; readonly symbol?: string }>> = {
  ArrowUp: { name: 'Arrow up', symbol: '↑' },
  ArrowDown: { name: 'Arrow down', symbol: '↓' },
  ArrowLeft: { name: 'Arrow left', symbol: '←' },
  ArrowRight: { name: 'Arrow right', symbol: '→' },
  Escape: { name: 'Escape', symbol: 'Esc' },
  ShiftLeft: { name: 'Left Shift' },
  ShiftRight: { name: 'Right Shift' },
  ControlLeft: { name: 'Left Ctrl' },
  ControlRight: { name: 'Right Ctrl' },
  AltLeft: { name: 'Left Alt' },
  AltRight: { name: 'Right Alt' },
};

/** The name of a key: "Arrow up", "W", "1", "Space". */
export function keyName(code: string): string {
  return KEY_CAPS[code]?.name ?? code.replace(/^(Key|Digit)/, '');
}

/** A key cap: the printed symbol where there is one, the name for assistive technology. */
export function KeyCap({ code }: { readonly code: string }): JSX.Element {
  const symbol = KEY_CAPS[code]?.symbol;
  const name = keyName(code);
  return symbol === undefined ? (
    <KeyHint>{name}</KeyHint>
  ) : (
    <KeyHint symbol={symbol}>{name}</KeyHint>
  );
}
