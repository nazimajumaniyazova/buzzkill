import {
  dailyDate,
  type Difficulty,
  type GameMode,
  type HeroId,
  parseReplay,
  type Replay,
  serializeReplay,
  simulate,
} from '@buzzkill/game';
import * as z from 'zod/mini';

/**
 * The longest run the server plays: 15 minutes of ticks. A whole campaign takes about 4.5
 * minutes, and the tick limit is what keeps a run that stalls in front of the queen within the
 * 2 s of CPU of an Edge Function. At the campaign's 3.4 µs a tick, the costliest measured, the
 * limit costs 0.18 s (ADR-0009, amendment of 2026-11-20).
 */
export const MAX_RUN_TICKS = 15 * 60 * 60;

/**
 * The largest request the server reads. A whole campaign's replay is about 17 kB of JSON; a run of
 * 15 minutes with many more changes of input still fits.
 */
export const MAX_SUBMISSION_BYTES = 128 * 1024;

/** The game speeds of the settings (ADR-0014); only runs at 1 enter the boards. */
const GAME_SPEEDS = [1, 0.75, 0.5] as const;

/** The result the client found when its run ended, which the server must find too. */
const CLAIM = z.object({
  score: z.int().check(z.nonnegative()),
  level: z.int().check(z.positive()),
  ticks: z.int().check(z.nonnegative()),
  hash: z.string().check(z.regex(/^[0-9a-f]{8}$/)),
});

const SUBMISSION = z.object({
  replay: z.unknown(),
  claimed: CLAIM,
  speed: z.literal(GAME_SPEEDS),
});

export type Claim = z.infer<typeof CLAIM>;

export interface VerifyContext {
  /** The version of the game the server was built with; only its replays are played. */
  readonly gameVersion: string;
  /** Today's date in UTC, as `YYYY-MM-DD`. */
  readonly today: string;
  /** The tick limit, `MAX_RUN_TICKS` when left out; tests make it smaller. */
  readonly maxTicks?: number;
}

/** A run the server played and found as claimed, ready to be stored. */
export interface VerifiedRun {
  readonly mode: 'classic' | 'daily';
  readonly dailyDate: string | null;
  readonly difficulty: Difficulty;
  readonly heroId: HeroId;
  readonly timeOfDay: GameMode;
  /** The game speed in percent: 100, 75 or 50. */
  readonly speed: number;
  readonly gameVersion: string;
  readonly seed: number;
  readonly score: number;
  readonly level: number;
  readonly ticks: number;
  readonly status: 'won' | 'lost';
  readonly stateHash: string;
  /** The replay as canonical JSON (`serializeReplay`). */
  readonly replay: string;
}

/** Why a submission was refused, with the HTTP status the function answers with. */
export type Rejection =
  | {
      readonly ok: false;
      readonly status: 400 | 409 | 413 | 422;
      readonly reason: 'invalid' | 'stale-version' | 'too-large' | 'not-today' | 'unfinished';
      readonly detail: string;
      readonly suspicious: false;
    }
  | {
      readonly ok: false;
      readonly status: 422;
      readonly reason: 'mismatch';
      readonly detail: string;
      /** A replay that plays to another result than its claim: the log of #218 keeps it. */
      readonly suspicious: true;
      readonly claimed: Claim;
      readonly found: Claim;
    };

export type Verdict = { readonly ok: true; readonly run: VerifiedRun } | Rejection;

function reject(
  status: 400 | 409 | 413 | 422,
  reason: 'invalid' | 'stale-version' | 'too-large' | 'not-today' | 'unfinished',
  detail: string,
): Rejection {
  return { ok: false, status, reason, detail, suspicious: false };
}

/** The length of `text` in UTF-8, without the DOM's TextEncoder. */
function utf8Length(text: string): number {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x1_00_00 ? 3 : 4;
  }
  return bytes;
}

/** The replay's `gameVersion`, read before the replay itself, whose format may be another's. */
function versionOf(replay: unknown): string | undefined {
  if (typeof replay === 'object' && replay !== null && 'gameVersion' in replay) {
    const { gameVersion } = replay;
    return typeof gameVersion === 'string' ? gameVersion : undefined;
  }
  return undefined;
}

/** The day before `date` (`YYYY-MM-DD`). */
function dayBefore(date: string): string {
  const moment = new Date(`${date}T00:00:00Z`);
  moment.setUTCDate(moment.getUTCDate() - 1);
  return dailyDate(moment);
}

function runOf(replay: Replay, claim: Claim, status: 'won' | 'lost', speed: number): VerifiedRun {
  return {
    mode: replay.daily === null ? 'classic' : 'daily',
    dailyDate: replay.daily,
    difficulty: replay.difficulty,
    heroId: replay.heroId,
    timeOfDay: replay.mode,
    speed: Math.round(speed * 100),
    gameVersion: replay.gameVersion,
    seed: replay.seed,
    score: claim.score,
    level: claim.level,
    ticks: claim.ticks,
    status,
    stateHash: claim.hash,
    replay: serializeReplay(replay),
  };
}

/**
 * Decides whether a submitted run may be stored (#218, ADR-0009). `body` is the request's text,
 * so its size is checked before anything reads it. The replay is played again with `simulate`
 * from the same `@buzzkill/game` as the browser's, and the run is accepted only when the server
 * reaches the score, level, ticks and state hash the client claimed.
 */
export function verifySubmission(body: string, context: VerifyContext): Verdict {
  if (body.length > MAX_SUBMISSION_BYTES || utf8Length(body) > MAX_SUBMISSION_BYTES) {
    return reject(
      413,
      'too-large',
      `a submission is at most ${String(MAX_SUBMISSION_BYTES)} bytes`,
    );
  }

  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return reject(400, 'invalid', 'the submission is not valid JSON');
  }
  const submission = SUBMISSION.safeParse(value);
  if (!submission.success) {
    return reject(400, 'invalid', z.prettifyError(submission.error));
  }
  const { claimed, speed } = submission.data;

  const version = versionOf(submission.data.replay);
  if (version !== undefined && version !== context.gameVersion) {
    return reject(
      409,
      'stale-version',
      `the replay comes from version ${version} of the game and the server plays ${context.gameVersion}: reload the page`,
    );
  }

  const parsed = parseReplay(submission.data.replay);
  if (!parsed.ok) {
    return reject(400, 'invalid', parsed.error);
  }
  const { replay } = parsed;

  // A daily run counts on the day it was played, or the day before when it ended after midnight.
  if (
    replay.daily !== null &&
    replay.daily !== context.today &&
    replay.daily !== dayBefore(context.today)
  ) {
    return reject(422, 'not-today', `the daily run of ${replay.daily} is over`);
  }

  const result = simulate(replay, { maxTicks: context.maxTicks ?? MAX_RUN_TICKS });
  if (result.status !== 'won' && result.status !== 'lost') {
    return reject(422, 'unfinished', `the run is not over after ${String(result.ticks)} ticks`);
  }

  const found: Claim = {
    score: result.score,
    level: result.level,
    ticks: result.ticks,
    hash: result.hash,
  };
  if (
    found.score !== claimed.score ||
    found.level !== claimed.level ||
    found.ticks !== claimed.ticks ||
    found.hash !== claimed.hash
  ) {
    return {
      ok: false,
      status: 422,
      reason: 'mismatch',
      detail: 'the replay does not play to the claimed result',
      suspicious: true,
      claimed,
      found,
    };
  }

  return { ok: true, run: runOf(replay, claimed, result.status, speed) };
}
