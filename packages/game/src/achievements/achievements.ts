import type { GameMode } from '../config/enemies';
import type { GameEventSource } from '../game/create-game';
import type { GameEvents } from '../simulation/state';

/**
 * Achievements as data (#163): each counts the run's events toward a goal. The counts add up
 * across runs, kept on the device by the shell and merged with the account in stage 8. They only
 * read events, so the simulation and its replays are the same with or without them.
 */

/** What a run has seen so far that a condition may read. */
export interface RunContext {
  /** The time of day of the level being played. */
  readonly mode: GameMode;
  /** Lives the hero lost in the level being played. */
  readonly hitsThisLevel: number;
  /** Lives the hero lost in the run. */
  readonly hitsThisRun: number;
}

/** For some events, how far one moves an achievement: a pure function of the event and the run. */
export type AchievementCounts = {
  readonly [K in keyof GameEvents]?: (payload: GameEvents[K], run: RunContext) => number;
};

export interface AchievementConfig<TId extends string = string> {
  readonly id: TId;
  /** The count that earns it: 1 for a feat, more for a tally. */
  readonly goal: number;
  readonly counts: AchievementCounts;
}

const one = (): number => 1;

/**
 * The score of the high score achievement. A campaign won on the easy difficulty scores about 340
 * (the golden replays).
 */
export const ACHIEVEMENT_SCORE = 250;

/** Every achievement, in the order the shell lists them. */
export const ACHIEVEMENTS = [
  { id: 'firstSwat', goal: 1, counts: { enemyDestroyed: one } },
  { id: 'swatter', goal: 500, counts: { enemyDestroyed: one } },
  {
    id: 'nightShift',
    goal: 100,
    counts: { enemyDestroyed: (_, run) => (run.mode === 'night' ? 1 : 0) },
  },
  {
    id: 'untouched',
    goal: 1,
    counts: { levelCleared: (_, run) => (run.hitsThisLevel === 0 ? 1 : 0) },
  },
  { id: 'collector', goal: 25, counts: { powerUpCollected: one } },
  { id: 'regicide', goal: 1, counts: { bossDefeated: one } },
  { id: 'champion', goal: 1, counts: { gameOver: ({ result }) => (result === 'won' ? 1 : 0) } },
  {
    id: 'flawless',
    goal: 1,
    counts: {
      gameOver: ({ result }, run) => (result === 'won' && run.hitsThisRun === 0 ? 1 : 0),
    },
  },
  {
    id: 'highScore',
    goal: 1,
    counts: { gameOver: ({ score }) => (score >= ACHIEVEMENT_SCORE ? 1 : 0) },
  },
] as const satisfies readonly AchievementConfig[];

export type AchievementId = (typeof ACHIEVEMENTS)[number]['id'];

/** The count of each achievement, never above its goal. */
export type AchievementProgress = Readonly<Record<AchievementId, number>>;

/** The data seen through its general type, so a condition can be looked up by event. */
const CONFIGS: readonly AchievementConfig<AchievementId>[] = ACHIEVEMENTS;

/** Progress before anything happened: every count at zero. */
export function noProgress(): AchievementProgress {
  // Empty until the loop below fills in every id.
  const progress = {} as Record<AchievementId, number>;
  for (const { id } of CONFIGS) {
    progress[id] = 0;
  }
  return progress;
}

/** The achievements `progress` has earned, in the order of the data. */
export function unlocked(progress: AchievementProgress): AchievementId[] {
  return CONFIGS.filter(({ id, goal }) => progress[id] >= goal).map(({ id }) => id);
}

export interface FollowOptions {
  /** The time of day the run starts at. */
  readonly mode: GameMode;
  /** The progress before the run. */
  readonly progress: AchievementProgress;
  /** Called with the new progress after each event that moved it, and what it earned, if any. */
  readonly onChange: (progress: AchievementProgress, earned: readonly AchievementId[]) => void;
}

/** Follows one run's events and counts them toward the achievements. */
export function followAchievements(events: GameEventSource, options: FollowOptions): void {
  const run = { mode: options.mode, hitsThisLevel: 0, hitsThisRun: 0 };
  let current = options.progress;

  // The run's context first: a condition reads it as it stands after the event.
  events.on('levelStarted', ({ mode }) => {
    run.mode = mode;
    run.hitsThisLevel = 0;
  });
  events.on('playerHit', () => {
    run.hitsThisLevel += 1;
    run.hitsThisRun += 1;
  });

  const count = <K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void => {
    let next: Record<AchievementId, number> | null = null;
    const earned: AchievementId[] = [];
    for (const { id, goal, counts } of CONFIGS) {
      const counter = counts[type];
      const before = current[id];
      if (counter === undefined || before >= goal) {
        continue;
      }
      const step = counter(payload, run);
      if (step <= 0) {
        continue;
      }
      next ??= { ...current };
      next[id] = Math.min(goal, before + step);
      if (next[id] >= goal) {
        earned.push(id);
      }
    }
    if (next !== null) {
      current = next;
      options.onChange(current, earned);
    }
  };

  const types = new Set<keyof GameEvents>();
  for (const { counts } of CONFIGS) {
    for (const type of Object.keys(counts)) {
      // The keys of `counts` are event names by its type.
      types.add(type as keyof GameEvents);
    }
  }
  for (const type of types) {
    events.on(type, (payload) => {
      count(type, payload);
    });
  }
}
