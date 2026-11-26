import { type AchievementId, type AchievementProgress, ACHIEVEMENTS } from '@buzzkill/game';

import { createStore, type Store } from '../store';
import { type AccountAchievement, mergeAchievements } from './merge';
import { type DeviceAchievements, mergeProgress, type UnlockTimes } from './progress';

/** What a run earned last: the achievements, and a number that grows with each report. */
export interface Earned {
  readonly ids: readonly AchievementId[];
  readonly serial: number;
}

export interface AchievementsState extends DeviceAchievements {
  readonly earned: Earned;
}

/**
 * - `counted`: a run counted toward the achievements: the new progress, what it earned, if
 *   anything, and `at`, the moment it was counted as an ISO instant.
 * - `merged`: the account's achievements came back from the backend (#221).
 */
type AchievementsEvent =
  | {
      readonly type: 'counted';
      readonly progress: AchievementProgress;
      readonly earned: readonly AchievementId[];
      readonly at: string;
    }
  | { readonly type: 'merged'; readonly account: readonly AccountAchievement[] };

export type AchievementsStore = Store<AchievementsState, AchievementsEvent>;

/**
 * Counts only grow, so the progress is the larger of the store's and the event's: a run counts
 * from the progress it started with, and a merge during the run must not be undone at its end.
 * For the same reason, what the account had unlocked is not reported as earned again.
 */
function achievementsTransition(
  state: AchievementsState,
  event: AchievementsEvent,
): AchievementsState {
  if (event.type === 'merged') {
    const { device } = mergeAchievements(state, event.account);
    return sameAchievements(state, device) ? state : { ...state, ...device };
  }
  const progress = mergeProgress(state.progress, event.progress);
  const earned = event.earned.filter((id) => state.unlockedAt[id] === undefined);
  if (earned.length === 0) {
    return { ...state, progress };
  }
  return {
    progress,
    unlockedAt: noteUnlocked(state.unlockedAt, earned, event.at),
    earned: { ids: earned, serial: state.earned.serial + 1 },
  };
}

/** Whether a merge changed nothing, so the store stays the same object and nobody hears of it. */
function sameAchievements(state: DeviceAchievements, merged: DeviceAchievements): boolean {
  return ACHIEVEMENTS.every(
    ({ id }) =>
      state.progress[id] === merged.progress[id] && state.unlockedAt[id] === merged.unlockedAt[id],
  );
}

/** `times`, with `at` for each achievement of `earned` that has no time yet (#221). */
function noteUnlocked(
  times: UnlockTimes,
  earned: readonly AchievementId[],
  at: string,
): UnlockTimes {
  const noted: Partial<Record<AchievementId, string>> = { ...times };
  for (const id of earned) {
    noted[id] ??= at;
  }
  return noted;
}

/**
 * The achievements of this device (#163), outside React's state: the progress changes with nearly
 * every insect, and a render of the shell per insect would undo the HUD's one commit per value
 * (#109). The shell saves the progress and the toasts read `earned`; nothing else subscribes.
 */
export function createAchievementsStore(device: DeviceAchievements): AchievementsStore {
  return createStore(achievementsTransition, { ...device, earned: { ids: [], serial: 0 } });
}
