import type { GameHaptic, GameHaptics } from '@buzzkill/game';

/**
 * Haptic feedback (#162, #154): a short buzz of the phone through the Vibration API and a short
 * rumble of every gamepad that can, when the hero is hit. Phones with Chromium have the Vibration
 * API, iOS and most desktops do not; Chromium and Firefox rumble a gamepad. Where nothing can, the
 * run feels nothing and the settings show no switch.
 */

/** How long the device vibrates for each haptic, in ms: short enough to read as a knock. */
export const HAPTIC_MS = {
  hit: 120,
} as const satisfies Record<GameHaptic, number>;

/** The strength of a gamepad's two motors in a rumble, from 0 to 1. */
export const RUMBLE = {
  /** The heavy motor, the low thud. */
  strong: 0.6,
  /** The light motor, the buzz. */
  weak: 0.4,
} as const;

/** What vibrates: the navigator's `vibrate`, bound to it. */
export interface Vibrator {
  vibrate(pattern: number): boolean;
}

/** The parameters of a dual rumble, as the Gamepad API takes them. */
interface RumbleParameters {
  readonly startDelay: number;
  readonly duration: number;
  readonly strongMagnitude: number;
  readonly weakMagnitude: number;
}

/** The part of a `Gamepad` that rumbles; a pad may have no actuator, or one without effects. */
export interface RumblePad {
  readonly connected: boolean;
  readonly vibrationActuator?: {
    playEffect?(type: 'dual-rumble', params: RumbleParameters): Promise<unknown>;
  } | null;
}

/**
 * The device's vibrator, or `null` where the navigator has none. The browser's `vibrate` throws
 * when called on anything but the navigator, so the vibrator calls it as a method of it.
 */
export function findVibrator(
  navigator: { readonly vibrate?: (pattern: number) => boolean } | undefined,
): Vibrator | null {
  if (typeof navigator?.vibrate !== 'function') {
    return null;
  }
  return {
    vibrate: (pattern) => navigator.vibrate?.(pattern) ?? false,
  };
}

/** Whether the browser can rumble a gamepad: it has the Gamepad API's haptic actuator. */
export function canRumble(globals: object): boolean {
  return (
    typeof (globals as { readonly GamepadHapticActuator?: unknown }).GamepadHapticActuator ===
    'function'
  );
}

/**
 * The browser's gamepads, or none where the API is missing or a permissions policy blocks it, as
 * in an embedding frame.
 */
export function browserGamepads(): readonly (RumblePad | null)[] {
  if (typeof navigator.getGamepads !== 'function') {
    return [];
  }
  return navigator.getGamepads();
}

export interface HapticsOptions {
  /** The vibration setting, read at every haptic. */
  readonly enabled: () => boolean;
  /** The phone's vibrator; `null` where it has none. */
  readonly vibrator: Vibrator | null;
  /** The gamepads at the moment of a haptic; it may throw where the API is blocked. */
  readonly gamepads: () => readonly (RumblePad | null)[];
}

/** The haptics of one run: the phone buzzes and the gamepads rumble, while the setting is on. */
export function createHaptics(options: HapticsOptions): GameHaptics {
  const rumble = (duration: number): void => {
    let pads: readonly (RumblePad | null)[];
    try {
      pads = options.gamepads();
    } catch {
      return;
    }
    const params: RumbleParameters = {
      startDelay: 0,
      duration,
      strongMagnitude: RUMBLE.strong,
      weakMagnitude: RUMBLE.weak,
    };
    for (const pad of pads) {
      const actuator = pad?.connected === true ? pad.vibrationActuator : null;
      if (typeof actuator?.playEffect === 'function') {
        // A pad may refuse the effect; a rumble that does not happen is nothing to report.
        actuator.playEffect('dual-rumble', params).catch(() => undefined);
      }
    }
  };
  return {
    play(haptic) {
      if (!options.enabled()) {
        return;
      }
      options.vibrator?.vibrate(HAPTIC_MS[haptic]);
      rumble(HAPTIC_MS[haptic]);
    },
  };
}
