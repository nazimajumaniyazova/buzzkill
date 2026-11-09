import { KeyHint } from '@buzzkill/ui';
import type { JSX } from 'react';

import type { Messages } from './i18n/en';
import { useI18n } from './i18n/i18n';

/**
 * What is printed on the cap of a key, where that differs from its name. The print is the same
 * in every language, like the keys themselves; the name comes from the dictionary.
 */
export const KEY_SYMBOLS: Readonly<Partial<Record<string, string>>> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Escape: 'Esc',
};

type KeyNames = Messages['keys'];

function isNamed(code: string, names: KeyNames): code is keyof KeyNames {
  return Object.hasOwn(names, code);
}

/**
 * The name of a key in the current language: "Arrow up", "Space". A key the dictionary does not
 * name is called by its code, a letter or a digit without the prefix: "W", "1".
 */
export function keyName(code: string, names: KeyNames): string {
  return isNamed(code, names) ? names[code] : code.replace(/^(Key|Digit)/, '');
}

/** A key cap: the printed symbol where there is one, the name for assistive technology. */
export function KeyCap({ code }: { readonly code: string }): JSX.Element {
  const { t } = useI18n();
  const symbol = KEY_SYMBOLS[code];
  const name = keyName(code, t.keys);
  return symbol === undefined ? (
    <KeyHint>{name}</KeyHint>
  ) : (
    <KeyHint symbol={symbol}>{name}</KeyHint>
  );
}
