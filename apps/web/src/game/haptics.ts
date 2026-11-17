import type { GameHaptic, GameHaptics } from '@buzzkill/game';

/**
 * Haptic feedback through the Vibration API (#162): a short buzz when the hero is hit. Phones with
 * Chromium have the API; iOS and most desktops do not, and there the run has no haptics at all and
 * the settings show no switch for them.
 */

/** How long the device vibrates for each haptic, in ms: short enough to read as a knock. */
export const HAPTIC_MS = {
  hit: 120,
} as const satisfies Record<GameHaptic, number>;

/** What vibrates: the navigator's `vibrate`, bound to it. */
export interface Vibrator {
  vibrate(pattern: number): boolean;
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

export interface HapticsOptions {
  /** The vibration setting, read at every haptic. */
  readonly enabled: () => boolean;
  readonly vibrator: Vibrator;
}

/** The haptics of one run, on a device that can vibrate. */
export function createHaptics(options: HapticsOptions): GameHaptics {
  return {
    play(haptic) {
      if (options.enabled()) {
        options.vibrator.vibrate(HAPTIC_MS[haptic]);
      }
    },
  };
}
