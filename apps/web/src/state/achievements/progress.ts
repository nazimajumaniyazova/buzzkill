import {
  type AchievementId,
  type AchievementProgress,
  ACHIEVEMENTS,
  noProgress,
} from '@buzzkill/game';
import * as z from 'zod/mini';

import type { SettingsStorage } from '../settings/storage';

/** Where the progress of the achievements lives in `localStorage` (#163). */
export const ACHIEVEMENTS_KEY = 'buzzkill.achievements';

/** The version of the stored form. A new version comes with a migration, as for the settings. */
export const ACHIEVEMENTS_VERSION = 1;

/** The stored form: the version and a count per achievement id. */
const STORED = z.object({
  version: z.literal(ACHIEVEMENTS_VERSION),
  progress: z.record(z.string(), z.unknown()),
});

/** A count as stored: a whole number from zero, kept at most at the achievement's goal. */
const count = (value: unknown, goal: number): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? Math.min(value, goal) : 0;

/**
 * The progress in a stored object. Each count is mended on its own: missing or broken gives zero,
 * past the goal gives the goal, an id the game no longer has is dropped. Anything else, another
 * version included, gives no progress: the counts start over rather than the page failing.
 */
export function parseProgress(stored: unknown): AchievementProgress {
  const result = STORED.safeParse(stored);
  if (!result.success) {
    return noProgress();
  }
  const progress: Record<AchievementId, number> = { ...noProgress() };
  for (const { id, goal } of ACHIEVEMENTS) {
    progress[id] = count(result.data.progress[id], goal);
  }
  return progress;
}

/**
 * The larger count of each achievement: how the progress on this device will join the progress
 * of an account in stage 8, without losing any of either.
 */
export function mergeProgress(
  one: AchievementProgress,
  other: AchievementProgress,
): AchievementProgress {
  const merged: Record<AchievementId, number> = { ...one };
  for (const { id } of ACHIEVEMENTS) {
    merged[id] = Math.max(one[id], other[id]);
  }
  return merged;
}

/** The stored progress, or none where there is no storage or it cannot be read. Never throws. */
export function loadProgress(storage: SettingsStorage | null): AchievementProgress {
  try {
    const json = storage?.getItem(ACHIEVEMENTS_KEY) ?? null;
    return json === null ? noProgress() : parseProgress(JSON.parse(json));
  } catch {
    return noProgress();
  }
}

/** Stores the progress with its version. Never throws: a full or blocked storage loses it. */
export function saveProgress(progress: AchievementProgress, storage: SettingsStorage | null): void {
  try {
    storage?.setItem(ACHIEVEMENTS_KEY, JSON.stringify({ version: ACHIEVEMENTS_VERSION, progress }));
  } catch {
    // The progress of this visit stays on screen; the next visit starts from what was saved.
  }
}
