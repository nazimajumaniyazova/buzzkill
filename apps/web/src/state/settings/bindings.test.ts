// @vitest-environment node
import { DEFAULT_KEY_BINDINGS, GAME_ACTIONS } from '@buzzkill/game';
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import { remapKey } from './bindings';
import { KEYS_PER_ACTION } from './schema';

describe('remapKey', () => {
  it('binds a free key in the slot and displaces nothing', () => {
    const result = remapKey(DEFAULT_KEY_BINDINGS, 'fire', 1, 'KeyF');

    expect(result.bindings).toEqual({ ...DEFAULT_KEY_BINDINGS, fire: ['Space', 'KeyF'] });
    expect(result.displaced).toBeNull();
  });

  it("swaps with the action that held the key: it gets the slot's old key", () => {
    const result = remapKey(DEFAULT_KEY_BINDINGS, 'pause', 0, 'Space');

    expect(result.bindings).toEqual({
      ...DEFAULT_KEY_BINDINGS,
      fire: ['Escape', 'KeyJ'],
      pause: ['Space', 'KeyP'],
    });
    expect(result.displaced).toEqual({ action: 'fire', code: 'Escape' });
  });

  it('swaps the two slots of one action without calling it a conflict', () => {
    const result = remapKey(DEFAULT_KEY_BINDINGS, 'moveUp', 0, 'KeyW');

    expect(result.bindings.moveUp).toEqual(['KeyW', 'ArrowUp']);
    expect(result.displaced).toBeNull();
  });

  it('returns the same bindings when the slot already holds the key', () => {
    const result = remapKey(DEFAULT_KEY_BINDINGS, 'fire', 0, 'Space');

    expect(result.bindings).toBe(DEFAULT_KEY_BINDINGS);
    expect(result.displaced).toBeNull();
  });

  it('does not change the bindings it is given', () => {
    const before = JSON.stringify(DEFAULT_KEY_BINDINGS);

    remapKey(DEFAULT_KEY_BINDINGS, 'pause', 0, 'Space');

    expect(JSON.stringify(DEFAULT_KEY_BINDINGS)).toBe(before);
  });

  it('rejects a slot the settings do not have', () => {
    expect(() => remapKey(DEFAULT_KEY_BINDINGS, 'fire', KEYS_PER_ACTION, 'KeyF')).toThrow(
      RangeError,
    );
    expect(() => remapKey(DEFAULT_KEY_BINDINGS, 'fire', -1, 'KeyF')).toThrow(RangeError);
  });

  const codes = fc.constantFrom(
    'ArrowUp',
    'ArrowDown',
    'KeyW',
    'KeyS',
    'Space',
    'KeyJ',
    'Escape',
    'KeyP',
    'KeyF',
    'Enter',
    'ShiftLeft',
  );
  const remap = fc.record({
    action: fc.constantFrom(...GAME_ACTIONS),
    slot: fc.integer({ min: 0, max: KEYS_PER_ACTION - 1 }),
    code: codes,
  });

  test.prop([fc.array(remap, { maxLength: 40 })])(
    'keeps two keys per action and never binds a key twice, whatever the player does',
    (steps) => {
      let bindings = remapKey(DEFAULT_KEY_BINDINGS, 'fire', 0, 'Space').bindings;
      for (const { action, slot, code } of steps) {
        bindings = remapKey(bindings, action, slot, code).bindings;
        expect(bindings[action][slot]).toBe(code);
      }
      const all = GAME_ACTIONS.flatMap((action) => bindings[action]);

      expect(GAME_ACTIONS.map((action) => bindings[action].length)).toEqual([2, 2, 2, 2]);
      expect(new Set(all).size).toBe(all.length);
    },
  );
});
