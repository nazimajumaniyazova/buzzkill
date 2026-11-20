import * as z from 'zod/mini';

import type { RunStore, SuspiciousRun } from './submit-run';
import type { VerifiedRun } from './verify';

export interface FetchInit {
  readonly method: 'GET' | 'POST';
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
}

export interface FetchResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

/** The part of the platform's `fetch` the store uses; Deno's fits it. */
export type Fetch = (url: string, init: FetchInit) => Promise<FetchResponse>;

export interface SupabaseConfig {
  /** The project's URL, such as `https://abc.supabase.co`. */
  readonly url: string;
  /** A secret key (`sb_secret_…`) or the legacy service role key: it bypasses Row Level Security. */
  readonly key: string;
}

const USER = z.object({ id: z.string().check(z.minLength(1)) });
const INSERTED = z.tuple([z.object({ id: z.string() })]);
const SECRET_KEYS = z.record(z.string(), z.string());

/**
 * The project's URL and server key from the variables Supabase gives every Edge Function. The
 * new secret keys come as a JSON object of named keys, of which `default` is the project's
 * first; the legacy service role key, which Supabase retires by the end of 2026, is the fallback.
 */
export function supabaseConfigFromEnv(env: (name: string) => string | undefined): SupabaseConfig {
  const url = env('SUPABASE_URL');
  if (url === undefined) {
    throw new Error('SUPABASE_URL is not set');
  }
  const secretKeys = env('SUPABASE_SECRET_KEYS');
  const key =
    secretKeys === undefined
      ? env('SUPABASE_SERVICE_ROLE_KEY')
      : SECRET_KEYS.parse(JSON.parse(secretKeys))['default'];
  if (key === undefined) {
    throw new Error('neither SUPABASE_SECRET_KEYS.default nor SUPABASE_SERVICE_ROLE_KEY is set');
  }
  return { url, key };
}

/** A bytea as PostgREST reads it from JSON: `\x` and the bytes in hex. */
function byteaOf(bytes: Uint8Array): string {
  let hex = '\\x';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Players and runs in Supabase, through its REST APIs rather than supabase-js, which the bundle
 * of the function would carry for three requests.
 *
 * - A player is whoever Auth says owns the access token (`/auth/v1/user`), anonymous or not.
 * - Runs and suspicious attempts go to PostgREST with the server key, the only role that may
 *   insert them (#216).
 */
export function createSupabaseStore({
  url,
  key,
  fetch,
}: SupabaseConfig & { readonly fetch: Fetch }): RunStore {
  const base = url.replace(/\/+$/, '');
  // A new key (`sb_…`) is not a JWT and goes only in `apikey`; a legacy key is a JWT that
  // PostgREST also expects as the bearer.
  const server: Record<string, string> = key.startsWith('sb_')
    ? { apikey: key }
    : { apikey: key, authorization: `Bearer ${key}` };

  async function insert(table: string, row: object, prefer: string): Promise<FetchResponse> {
    const response = await fetch(
      `${base}/rest/v1/${table}${prefer === 'return=representation' ? '?select=id' : ''}`,
      {
        method: 'POST',
        headers: { ...server, 'content-type': 'application/json', prefer },
        body: JSON.stringify(row),
      },
    );
    if (!response.ok) {
      throw new Error(`PostgREST answered ${String(response.status)}: ${await response.text()}`);
    }
    return response;
  }

  return {
    async userOf(token) {
      const response = await fetch(`${base}/auth/v1/user`, {
        method: 'GET',
        headers: { apikey: key, authorization: `Bearer ${token}` },
      });
      if (response.status === 401 || response.status === 403) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Auth answered ${String(response.status)}`);
      }
      return USER.parse(await response.json()).id;
    },

    async addRun(userId: string, run: VerifiedRun, replay: Uint8Array) {
      const response = await insert(
        'runs',
        {
          user_id: userId,
          mode: run.mode,
          daily_date: run.dailyDate,
          difficulty: run.difficulty,
          hero_id: run.heroId,
          time_of_day: run.timeOfDay,
          speed: run.speed,
          game_version: run.gameVersion,
          seed: run.seed,
          score: run.score,
          level: run.level,
          ticks: run.ticks,
          status: run.status,
          state_hash: run.stateHash,
          replay: byteaOf(replay),
        },
        'return=representation',
      );
      return INSERTED.parse(await response.json())[0].id;
    },

    async logSuspicious(attempt: SuspiciousRun) {
      await insert(
        'suspicious_runs',
        {
          user_id: attempt.userId,
          game_version: attempt.gameVersion,
          seed: attempt.seed,
          claimed: attempt.claimed,
          found: attempt.found,
          replay: byteaOf(attempt.replay),
        },
        'return=minimal',
      );
    },
  };
}
