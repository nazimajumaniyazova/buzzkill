// `zod/mini` instead of `zod`: the same validation with a tree-shakable functional API, so the
// game chunk carries only the checks it uses (the stage 9 bundle budget).
import * as z from 'zod/mini';

import { GAME_ACTIONS } from '../actions';
import { type Difficulty, DIFFICULTY_IDS } from '../config/difficulty';
import type { GameMode } from '../config/enemies';
import type { HeroId } from '../config/rules';
import { dailySeed, isDailyDate } from '../daily/daily';

/**
 * The replay of a run (ADR-0009): everything needed to play it again bit for bit.
 *
 * `inputs` stores only the changes of the set of actions down, as a flat list of pairs
 * `[ticksSincePreviousChange, downMask, ...]`. Before the first change nothing is down; a mask
 * holds until the next change. The first pair counts from tick 0, so `[1, 4]` means "fire is down
 * from tick 1". Flat numbers with small deltas keep the JSON short: a held key costs one pair,
 * however long it is held.
 */
export interface Replay {
  readonly formatVersion: typeof REPLAY_FORMAT_VERSION;
  /** The `@buzzkill/game` build that recorded it. The server only re-simulates the same build. */
  readonly gameVersion: string;
  readonly seed: number;
  readonly heroId: HeroId;
  readonly mode: GameMode;
  /** Since format 2 (#155): runs at different difficulties belong on different boards. */
  readonly difficulty: Difficulty;
  /**
   * Since format 3 (#165): the UTC date of a daily run as `YYYY-MM-DD`, whose seed must be the
   * day's (`dailySeed`); `null` for any other run.
   */
  readonly daily: string | null;
  readonly inputs: readonly number[];
}

/**
 * 3 since #165, which added `daily`; 2 since #155, which added `difficulty`. A replay of format 2
 * reads as one of format 3 that is not a daily run; no replay of format 1 was ever stored.
 */
export const REPLAY_FORMAT_VERSION = 3;

/**
 * The bits a replay may contain: every action but `pause`. A paused tick is never simulated, so
 * the pause action has no effect on a run and is left out of its record.
 */
export const REPLAY_ACTION_MASK =
  ((1 << GAME_ACTIONS.length) - 1) & ~(1 << GAME_ACTIONS.indexOf('pause'));

/** Upper bound on input changes: well beyond an hour of play at several changes per second. */
export const MAX_REPLAY_CHANGES = 100_000;

const HERO_IDS = ['male', 'female', 'sam', 'leo'] as const satisfies readonly HeroId[];
const MODES = ['day', 'night'] as const satisfies readonly GameMode[];

/** Why the input list is not in canonical form, or `undefined` when it is. */
function inputsProblem(inputs: readonly number[]): string | undefined {
  if (inputs.length % 2 !== 0) {
    return 'inputs must be pairs of [ticks since the previous change, mask]';
  }
  let previousMask = 0;
  for (let i = 0; i < inputs.length; i += 2) {
    const delta = inputs[i] as number;
    const mask = inputs[i + 1] as number;
    if (delta < 1) {
      return `inputs[${String(i)}]: a change must come at least one tick after the previous one`;
    }
    if ((mask & ~REPLAY_ACTION_MASK) !== 0) {
      return `inputs[${String(i + 1)}]: mask ${String(mask)} has bits outside the replay actions`;
    }
    if (mask === previousMask) {
      return `inputs[${String(i + 1)}]: mask ${String(mask)} repeats the previous one`;
    }
    previousMask = mask;
  }
  return undefined;
}

const fields = {
  gameVersion: z.string().check(z.minLength(1), z.maxLength(64)),
  seed: z.uint32(),
  heroId: z.enum(HERO_IDS),
  mode: z.enum(MODES),
  difficulty: z.enum(DIFFICULTY_IDS),
  inputs: z.array(z.int().check(z.nonnegative(), z.lte(0x7f_ff_ff_ff))).check(
    z.maxLength(MAX_REPLAY_CHANGES * 2),
    z.superRefine((inputs, context) => {
      const problem = inputsProblem(inputs);
      if (problem !== undefined) {
        context.addIssue({ code: 'custom', message: problem, input: inputs });
      }
    }),
  ),
};

/** Format 2, from #155 to #165: everything but `daily`. */
const format2Schema = z.object({ formatVersion: z.literal(2), ...fields });

const replaySchema = z
  .object({
    formatVersion: z.literal(REPLAY_FORMAT_VERSION),
    ...fields,
    daily: z.nullable(
      z.string().check(z.refine(isDailyDate, 'daily must be a date written as YYYY-MM-DD')),
    ),
  })
  .check(
    z.refine(
      (replay) =>
        replay.daily === null ||
        !isDailyDate(replay.daily) ||
        replay.seed === dailySeed(replay.daily),
      {
        message: "daily: the seed of a daily run must be its day's",
        path: ['daily'],
      },
    ),
  );

export type ReplayParseResult =
  { readonly ok: true; readonly replay: Replay } | { readonly ok: false; readonly error: string };

/**
 * Validates untrusted data as a replay: the server's view of what a client sent, or a file a
 * player loaded. Unknown fields are dropped. Never throws.
 */
export function parseReplay(value: unknown): ReplayParseResult {
  const old = format2Schema.safeParse(value);
  if (old.success) {
    return { ok: true, replay: { ...old.data, formatVersion: REPLAY_FORMAT_VERSION, daily: null } };
  }
  const result = replaySchema.safeParse(value);
  if (result.success) {
    return { ok: true, replay: result.data };
  }
  return { ok: false, error: z.prettifyError(result.error) };
}

/** The replay as compact JSON with a fixed field order. */
export function serializeReplay(replay: Replay): string {
  const { formatVersion, gameVersion, seed, heroId, mode, difficulty, daily, inputs } = replay;
  return JSON.stringify({
    formatVersion,
    gameVersion,
    seed,
    heroId,
    mode,
    difficulty,
    daily,
    inputs,
  });
}

/** Parses the output of `serializeReplay`; malformed JSON is reported like any other problem. */
export function deserializeReplay(json: string): ReplayParseResult {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return { ok: false, error: 'the replay is not valid JSON' };
  }
  return parseReplay(value);
}
