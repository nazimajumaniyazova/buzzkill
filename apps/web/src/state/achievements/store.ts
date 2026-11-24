import type { AchievementId, AchievementProgress } from '@buzzkill/game';

import { createStore, type Store } from '../store';
import type { DeviceAchievements, UnlockTimes } from './progress';

/** What a run earned last: the achievements, and a number that grows with each report. */
export interface Earned {
  readonly ids: readonly AchievementId[];
  readonly serial: number;
}

export interface AchievementsState extends DeviceAchievements {
  readonly earned: Earned;
}

/**
 * A run counted toward the achievements: the new progress, what it earned, if anything, and
 * `at`, the moment it was counted as an ISO instant.
 */
interface AchievementsEvent {
  readonly type: 'counted';
  readonly progress: AchievementProgress;
  readonly earned: readonly AchievementId[];
  readonly at: string;
}

export type AchievementsStore = Store<AchievementsState, AchievementsEvent>;

function achievementsTransition(
  state: AchievementsState,
  event: AchievementsEvent,
): AchievementsState {
  if (event.earned.length === 0) {
    return { ...state, progress: event.progress };
  }
  return {
    progress: event.progress,
    unlockedAt: noteUnlocked(state.unlockedAt, event.earned, event.at),
    earned: { ids: event.earned, serial: state.earned.serial + 1 },
  };
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
