import { type AchievementId, ACHIEVEMENTS, noProgress } from '@buzzkill/game';

import { type DeviceAchievements, mergeProgress, type UnlockTimes } from './progress';

/**
 * An achievement of the account: a row of the `achievements` table, read and checked by the
 * caller, so its id is one the game knows. `unlockedAt` is an ISO 8601 instant.
 */
export interface AccountAchievement {
  readonly id: AchievementId;
  readonly unlockedAt: string;
}

export interface MergedAchievements {
  /** The device's achievements, with every one the account has unlocked. */
  readonly device: DeviceAchievements;
  /**
   * What the account lacks: each achievement the device unlocked that the account has not, or
   * has with a later time. The table keeps the earlier time of a row sent again.
   */
  readonly toAccount: readonly AccountAchievement[];
}

/**
 * Joins the device's achievements and the account's (#221), so that playing on a second device
 * loses nothing. An achievement unlocked on either side is unlocked on both, at the earlier of its
 * times; the counts of an achievement the account has unlocked reach its goal, so the heroes it
 * unlocks follow (#164). The counts of achievements not unlocked stay the device's: the account
 * keeps no counts. Pure, and done after once: merging the result again changes nothing.
 */
export function mergeAchievements(
  device: DeviceAchievements,
  account: readonly AccountAchievement[],
): MergedAchievements {
  const accountTimes = new Map<AchievementId, number>();
  for (const { id, unlockedAt } of account) {
    const time = Date.parse(unlockedAt);
    if (!Number.isNaN(time)) {
      accountTimes.set(id, Math.min(time, accountTimes.get(id) ?? time));
    }
  }

  const reached: Record<AchievementId, number> = { ...noProgress() };
  const unlockedAt: Partial<Record<AchievementId, string>> = {};
  const toAccount: AccountAchievement[] = [];
  for (const { id, goal } of ACHIEVEMENTS) {
    const here = timeOf(device.unlockedAt, id);
    const there = accountTimes.get(id);
    const earliest = Math.min(here ?? Infinity, there ?? Infinity);
    if (earliest !== Infinity) {
      reached[id] = goal;
      unlockedAt[id] = new Date(earliest).toISOString();
    }
    if (here !== undefined && (there === undefined || here < there)) {
      toAccount.push({ id, unlockedAt: new Date(here).toISOString() });
    }
  }

  return {
    device: { progress: mergeProgress(device.progress, reached), unlockedAt },
    toAccount,
  };
}

/** The time `times` holds for `id`, in milliseconds, if it holds one it can read. */
function timeOf(times: UnlockTimes, id: AchievementId): number | undefined {
  const time = Date.parse(times[id] ?? '');
  return Number.isNaN(time) ? undefined : time;
}
