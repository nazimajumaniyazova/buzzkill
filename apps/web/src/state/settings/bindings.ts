import type { KeyBindings } from '@buzzkill/engine';
import { GAME_ACTIONS, type GameAction } from '@buzzkill/game';

import { KEYS_PER_ACTION } from './schema';

export interface RemapResult {
  readonly bindings: KeyBindings<GameAction>;
  /**
   * The other action that held the key, with the key it holds now in its place; `null` when the
   * key was free or held by the same action.
   */
  readonly displaced: { readonly action: GameAction; readonly code: string } | null;
}

/**
 * Binds `code` to slot `slot` of `action`. A key held elsewhere swaps places with the slot's old
 * key, so no key is ever bound twice and no action is ever left without its keys: the conflict
 * is resolved, and `displaced` says how, for the screen to announce. Returns new bindings; the
 * given ones are not changed.
 */
export function remapKey(
  bindings: KeyBindings<GameAction>,
  action: GameAction,
  slot: number,
  code: string,
): RemapResult {
  if (!Number.isInteger(slot) || slot < 0 || slot >= KEYS_PER_ACTION) {
    throw new RangeError(`remapKey: slot must be 0 to ${String(KEYS_PER_ACTION - 1)}`);
  }
  const previous = bindings[action][slot];
  if (previous === code) {
    return { bindings, displaced: null };
  }
  // `Object.fromEntries` types its keys as strings; GAME_ACTIONS lists every action, so the
  // object has exactly the keys of the record.
  const next = Object.fromEntries(
    GAME_ACTIONS.map((each) => [each, [...bindings[each]]]),
  ) as Record<GameAction, string[]>;
  let displaced: RemapResult['displaced'] = null;
  for (const holder of GAME_ACTIONS) {
    const index = next[holder].indexOf(code);
    if (index === -1 || previous === undefined) {
      continue;
    }
    next[holder][index] = previous;
    if (holder !== action) {
      displaced = { action: holder, code: previous };
    }
  }
  next[action][slot] = code;
  return { bindings: next, displaced };
}
