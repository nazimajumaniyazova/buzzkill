import { dailyDate } from '@buzzkill/game';

import { type Claim, MAX_SUBMISSION_BYTES, type VerifiedRun, verifySubmission } from './verify';

/**
 * The little of an HTTP request the function reads. Deno's `Request` provides it through a thin
 * adapter, and the package needs no platform's types.
 */
export interface HttpRequest {
  readonly method: string;
  /** A header's value, or null when absent. Names are lower case. */
  header(name: string): string | null;
  text(): Promise<string>;
}

export interface HttpResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  /** JSON, or null for no body. */
  readonly body: string | null;
}

/** A suspicious attempt, as the log of `supabase/migrations` keeps it. */
export interface SuspiciousRun {
  readonly userId: string;
  readonly gameVersion: string;
  readonly seed: number;
  readonly claimed: Claim;
  readonly found: Claim;
  /** The replay's JSON, gzipped. */
  readonly replay: Uint8Array;
}

/**
 * A run stored, with its row's id, or refused because the player's last hour already holds as
 * much play as an hour can (#235); `retryAfter` is the seconds until it has room for this run.
 */
export type AddedRun =
  { readonly ok: true; readonly id: string } | { readonly ok: false; readonly retryAfter: number };

/** Where the function finds players and keeps runs: Supabase, or a fake in a test. */
export interface RunStore {
  /** The id of the player whose access token this is, or null when Auth does not know it. */
  userOf(token: string): Promise<string | null>;
  /** Stores a verified run with its gzipped replay, unless the player is over the hour's limit. */
  addRun(userId: string, run: VerifiedRun, replay: Uint8Array): Promise<AddedRun>;
  logSuspicious(run: SuspiciousRun): Promise<void>;
}

export interface SubmitRunDependencies {
  /** The version the function was built with: `gameVersion()` of `@buzzkill/config`. */
  readonly gameVersion: string;
  readonly now: () => Date;
  readonly gzip: (text: string) => Promise<Uint8Array>;
  readonly store: RunStore;
  /** Where an unexpected failure goes: the function's log. */
  readonly report: (message: string, error: unknown) => void;
}

/** The largest replay a row of `runs` or `suspicious_runs` holds, gzipped. */
const MAX_STORED_REPLAY_BYTES = 64 * 1024;

const ALLOWED_METHODS = 'POST, OPTIONS';

/**
 * Any origin may call: the request carries its token in a header, never in a cookie, so another
 * site gains nothing a script could not do with the token anyway.
 */
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': ALLOWED_METHODS,
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  // The browser hides every other response header from a script of another origin.
  'access-control-expose-headers': 'retry-after',
};

function answer(status: number, body: object, headers: Record<string, string> = {}): HttpResponse {
  return {
    status,
    headers: { ...CORS, 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  };
}

const refuse = (status: number, reason: string, detail: string): HttpResponse =>
  answer(status, { reason, detail });

const unavailable = (): HttpResponse =>
  refuse(503, 'unavailable', 'the server cannot store runs right now: try again later');

function bearerToken(header: string | null): string | null {
  const match = /^Bearer (\S+)$/.exec(header ?? '');
  return match?.[1] ?? null;
}

/**
 * The submit-run function (#218): a signed-in player sends a finished run, the server plays its
 * replay again, stores it when it plays to the claim and logs it when it does not.
 *
 * The cheap checks come first, so a stranger cannot make the server play: the method, the
 * announced size and the token, before the body is read. Only then does `verifySubmission` play
 * the replay. A player learns why a run was refused, but never the result the server found.
 */
export function createSubmitRun({
  gameVersion,
  now,
  gzip,
  store,
  report,
}: SubmitRunDependencies): (request: HttpRequest) => Promise<HttpResponse> {
  return async (request) => {
    if (request.method === 'OPTIONS') {
      return { status: 204, headers: CORS, body: null };
    }
    if (request.method !== 'POST') {
      return answer(
        405,
        { reason: 'method-not-allowed', detail: 'send the run with POST' },
        { allow: ALLOWED_METHODS },
      );
    }
    if (Number(request.header('content-length') ?? 0) > MAX_SUBMISSION_BYTES) {
      return refuse(
        413,
        'too-large',
        `a submission is at most ${String(MAX_SUBMISSION_BYTES)} bytes`,
      );
    }

    const token = bearerToken(request.header('authorization'));
    let userId: string | null = null;
    if (token !== null) {
      try {
        userId = await store.userOf(token);
      } catch (error) {
        report('reading the player from Auth failed', error);
        return unavailable();
      }
    }
    if (userId === null) {
      return refuse(401, 'unauthorized', 'sign in to submit a run');
    }

    const verdict = verifySubmission(await request.text(), {
      gameVersion,
      today: dailyDate(now()),
    });

    if (!verdict.ok) {
      if (verdict.suspicious) {
        try {
          await store.logSuspicious({
            userId,
            gameVersion: verdict.gameVersion,
            seed: verdict.seed,
            claimed: verdict.claimed,
            found: verdict.found,
            replay: await gzip(verdict.replay),
          });
        } catch (error) {
          // The log is for the owner; the player's answer is the same without it.
          report('logging a suspicious run failed', error);
        }
      }
      return refuse(verdict.status, verdict.reason, verdict.detail);
    }

    const { run } = verdict;
    const replay = await gzip(run.replay);
    if (replay.length > MAX_STORED_REPLAY_BYTES) {
      return refuse(413, 'too-large', 'the replay is too long to store');
    }
    let added: AddedRun;
    try {
      added = await store.addRun(userId, run, replay);
    } catch (error) {
      report('storing a run failed', error);
      return unavailable();
    }
    if (!added.ok) {
      return answer(
        429,
        {
          reason: 'too-many-runs',
          detail: 'a player cannot submit more play in an hour than an hour holds',
        },
        { 'retry-after': String(added.retryAfter) },
      );
    }
    return answer(201, {
      id: added.id,
      score: run.score,
      level: run.level,
      ticks: run.ticks,
      hash: run.stateHash,
      status: run.status,
    });
  };
}
