/**
 * The game's input vocabulary. Every source (keyboard, touch buttons, gamepad) is translated into
 * these four actions by the engine's input module, and a replay records only them (ADR-0009).
 * The order is the bit order of the engine's input masks, so it is part of the replay format:
 * append new actions, never reorder.
 */
export const GAME_ACTIONS = ['moveUp', 'moveDown', 'fire', 'pause'] as const;

export type GameAction = (typeof GAME_ACTIONS)[number];

/**
 * Default keyboard bindings as `KeyboardEvent.code` values, which name physical keys, so WASD
 * stays in place on AZERTY. The 2023 game used the arrows and Space; W/S, J and P/Escape are
 * the usual alternatives. Shaped like the engine's `KeyBindings<GameAction>`.
 */
export const DEFAULT_KEY_BINDINGS = {
  moveUp: ['ArrowUp', 'KeyW'],
  moveDown: ['ArrowDown', 'KeyS'],
  fire: ['Space', 'KeyJ'],
  pause: ['Escape', 'KeyP'],
} as const satisfies Readonly<Record<GameAction, readonly string[]>>;

/**
 * Default gamepad bindings in the W3C standard mapping: D-pad and left stick to move, the bottom
 * face button to fire, Start to pause. Shaped like the engine's `GamepadBindings<GameAction>`.
 */
export const DEFAULT_GAMEPAD_BINDINGS = {
  buttons: { moveUp: [12], moveDown: [13], fire: [0], pause: [9] },
  axes: {
    moveUp: [{ axis: 1, direction: -1 }],
    moveDown: [{ axis: 1, direction: 1 }],
  },
} as const satisfies {
  readonly buttons: Readonly<Record<GameAction, readonly number[]>>;
  readonly axes: Readonly<
    Partial<Record<GameAction, readonly { readonly axis: number; readonly direction: -1 | 1 }[]>>
  >;
};
