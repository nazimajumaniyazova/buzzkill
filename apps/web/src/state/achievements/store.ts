import type { AchievementId, AchievementProgress } from '@buzzkill/game';

import { createStore, type Store } from '../store';

/** What a run earned last: the achievements, and a number that grows with each report. */
export interface Earned {
  readonly ids: readonly AchievementId[];
  readonly serial: number;
}

export interface AchievementsState {
  readonly progress: AchievementProgress;
  readonly earned: Earned;
}

/** A run counted toward the achievements: the new progress, and what it earned, if anything. */
interface AchievementsEvent {
  readonly type: 'counted';
  readonly progress: AchievementProgress;
  readonly earned: readonly AchievementId[];
}

export type AchievementsStore = Store<AchievementsState, AchievementsEvent>;

function achievementsTransition(
  state: AchievementsState,
  event: AchievementsEvent,
): AchievementsState {
  return {
    progress: event.progress,
    earned:
      event.earned.length === 0
        ? state.earned
        : { ids: event.earned, serial: state.earned.serial + 1 },
  };
}

/**
 * The achievements of this device (#163), outside React's state: the progress changes with nearly
 * every insect, and a render of the shell per insect would undo the HUD's one commit per value
 * (#109). The shell saves the progress and the toasts read `earned`; nothing else subscribes.
 */
export function createAchievementsStore(progress: AchievementProgress): AchievementsStore {
  return createStore(achievementsTransition, { progress, earned: { ids: [], serial: 0 } });
}
