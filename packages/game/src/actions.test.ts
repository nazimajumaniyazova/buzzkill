import { describe, expect, it } from 'vitest';

import { DEFAULT_GAMEPAD_BINDINGS, DEFAULT_KEY_BINDINGS, GAME_ACTIONS } from './actions';

describe('game actions', () => {
  it('keeps the replay bit order: moveUp, moveDown, fire, pause', () => {
    expect(GAME_ACTIONS).toEqual(['moveUp', 'moveDown', 'fire', 'pause']);
  });

  it('binds every action to at least one key and never one key to two actions', () => {
    const codes = GAME_ACTIONS.flatMap((action) => DEFAULT_KEY_BINDINGS[action]);

    for (const action of GAME_ACTIONS) {
      expect(DEFAULT_KEY_BINDINGS[action].length).toBeGreaterThan(0);
    }
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('keeps the 2023 controls: arrows to move, Space to fire', () => {
    expect(DEFAULT_KEY_BINDINGS.moveUp).toContain('ArrowUp');
    expect(DEFAULT_KEY_BINDINGS.moveDown).toContain('ArrowDown');
    expect(DEFAULT_KEY_BINDINGS.fire).toContain('Space');
  });

  it('binds every action to a gamepad button', () => {
    const buttons = GAME_ACTIONS.flatMap((action) => DEFAULT_GAMEPAD_BINDINGS.buttons[action]);

    expect(buttons).toHaveLength(GAME_ACTIONS.length);
    expect(new Set(buttons).size).toBe(buttons.length);
  });
});
