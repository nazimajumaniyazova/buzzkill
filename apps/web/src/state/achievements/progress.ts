import {
  type AchievementId,
  type AchievementProgress,
  ACHIEVEMENTS,
  noProgress,
} from '@buzzkill/game';
import * as z from 'zod/mini';

import type { SettingsStorage } from '../settings/storage';

/** Where the achievements of this device live in `localStorage` (#163). */
export const ACHIEVEMENTS_KEY = 'buzzkill.achievements';

/**
 * The version of the stored form. 1 kept the counts (#163); 2 adds when each achievement was
 * unlocked, for the merge with an account (#221). Version 1 is still read.
 */
export const ACHIEVEMENTS_VERSION = 2;

/** When each unlocked achievement was unlocked, as an ISO 8601 instant in UTC. */
export type UnlockTimes = Readonly<Partial<Record<AchievementId, string>>>;

/** The achievements of this device: a count per achievement, and when each one was unlocked. */
export interface DeviceAchievements {
  readonly progress: AchievementProgress;
  readonly unlockedAt: UnlockTimes;
}

/** Nothing counted and nothing unlocked. */
export function noAchievements(): DeviceAchievements {
  return { progress: noProgress(), unlockedAt: {} };
}

/** The stored form of either version; version 1 has no times. */
const STORED = z.object({
  version: z.union([z.literal(1), z.literal(ACHIEVEMENTS_VERSION)]),
  progress: z.record(z.string(), z.unknown()),
  unlockedAt: z.optional(z.record(z.string(), z.unknown())),
});

/** A count as stored: a whole number from zero, kept at most at the achievement's goal. */
const count = (value: unknown, goal: number): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? Math.min(value, goal) : 0;

/** A time as stored, written as an ISO instant in UTC, or `undefined` if it is not one. */
function instant(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}

/**
 * The achievements in a stored object. Each count is mended on its own: missing or broken gives
 * zero, past the goal gives the goal, an id the game no longer has is dropped. An unlocked
 * achievement keeps its time, or gets `now` where it has none it can read, as every unlocked one
 * of version 1 does; an achievement not unlocked keeps none. Anything else, an unknown version
 * included, gives nothing: the counts start over rather than the page failing.
 */
export function parseAchievements(stored: unknown, now: string): DeviceAchievements {
  const result = STORED.safeParse(stored);
  if (!result.success) {
    return noAchievements();
  }
  const { progress: counts, unlockedAt: times = {} } = result.data;
  const progress: Record<AchievementId, number> = { ...noProgress() };
  const unlockedAt: Partial<Record<AchievementId, string>> = {};
  for (const { id, goal } of ACHIEVEMENTS) {
    progress[id] = count(counts[id], goal);
    if (progress[id] >= goal) {
      unlockedAt[id] = instant(times[id]) ?? now;
    }
  }
  return { progress, unlockedAt };
}

/** The larger count of each achievement: neither side's progress is lost. */
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

/**
 * The stored achievements, or none where there is no storage or it cannot be read. `now` is the
 * time for an unlocked achievement whose time is not known. Never throws.
 */
export function loadAchievements(storage: SettingsStorage | null, now: string): DeviceAchievements {
  try {
    const json = storage?.getItem(ACHIEVEMENTS_KEY) ?? null;
    return json === null ? noAchievements() : parseAchievements(JSON.parse(json), now);
  } catch {
    return noAchievements();
  }
}

/**
 * Stores the counts and the times with their version, and nothing else `device` may hold. Never
 * throws: a full or blocked storage loses them.
 */
export function saveAchievements(
  { progress, unlockedAt }: DeviceAchievements,
  storage: SettingsStorage | null,
): void {
  try {
    storage?.setItem(
      ACHIEVEMENTS_KEY,
      JSON.stringify({ version: ACHIEVEMENTS_VERSION, progress, unlockedAt }),
    );
  } catch {
    // The progress of this visit stays on screen; the next visit starts from what was saved.
  }
}
