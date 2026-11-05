// `zod/mini` instead of `zod`: the same validation with a tree-shakable functional API, so the
// game chunk carries only the checks it uses (the stage 9 bundle budget).
import * as z from 'zod/mini';

import { GAME_ACTIONS } from '../actions';
import type { GameMode } from '../config/enemies';
import type { HeroId } from '../config/rules';

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
  readonly inputs: readonly number[];
}

export const REPLAY_FORMAT_VERSION = 1;

/**
 * The bits a replay may contain: every action but `pause`. A paused tick is never simulated, so
 * the pause action has no effect on a run and is left out of its record.
 */
export const REPLAY_ACTION_MASK =
  ((1 << GAME_ACTIONS.length) - 1) & ~(1 << GAME_ACTIONS.indexOf('pause'));

/** Upper bound on input changes: well beyond an hour of play at several changes per second. */
export const MAX_REPLAY_CHANGES = 100_000;

const HERO_IDS = ['male', 'female'] as const satisfies readonly HeroId[];
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

const replaySchema = z.object({
  formatVersion: z.literal(REPLAY_FORMAT_VERSION),
  gameVersion: z.string().check(z.minLength(1), z.maxLength(64)),
  seed: z.uint32(),
  heroId: z.enum(HERO_IDS),
  mode: z.enum(MODES),
  inputs: z.array(z.int().check(z.nonnegative(), z.lte(0x7f_ff_ff_ff))).check(
    z.maxLength(MAX_REPLAY_CHANGES * 2),
    z.superRefine((inputs, context) => {
      const problem = inputsProblem(inputs);
      if (problem !== undefined) {
        context.addIssue({ code: 'custom', message: problem, input: inputs });
      }
    }),
  ),
});

export type ReplayParseResult =
  { readonly ok: true; readonly replay: Replay } | { readonly ok: false; readonly error: string };

/**
 * Validates untrusted data as a replay: the server's view of what a client sent, or a file a
 * player loaded. Unknown fields are dropped. Never throws.
 */
export function parseReplay(value: unknown): ReplayParseResult {
  const result = replaySchema.safeParse(value);
  if (result.success) {
    return { ok: true, replay: result.data };
  }
  return { ok: false, error: z.prettifyError(result.error) };
}

/** The replay as compact JSON with a fixed field order. */
export function serializeReplay(replay: Replay): string {
  const { formatVersion, gameVersion, seed, heroId, mode, inputs } = replay;
  return JSON.stringify({ formatVersion, gameVersion, seed, heroId, mode, inputs });
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
