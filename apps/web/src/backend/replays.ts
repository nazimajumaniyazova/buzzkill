import { deserializeReplay, type Replay } from '@buzzkill/game';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.gen';

type Client = SupabaseClient<Database>;

/**
 * Why a stored run cannot be watched (#219):
 * - `not-found`: no run has this id;
 * - `offline`: the backend could not be reached or did not answer;
 * - `unreadable`: the stored replay is not one this game can read;
 * - `other-version`: the run was played on another version of the game, which would not play it
 *   the same way (ADR-0009).
 */
export type ReplayProblem = 'not-found' | 'offline' | 'unreadable' | 'other-version';

export type StoredReplay =
  | { readonly ok: true; readonly replay: Replay }
  | { readonly ok: false; readonly problem: ReplayProblem };

const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The most bytes a stored replay has, gzipped: the `runs` table's limit (#215). */
const MAX_STORED_BYTES = 64 * 1024;

/** The bytes of a bytea as PostgREST writes it in JSON, `\x` and hex, or `null`. */
function bytesOf(value: string): Uint8Array<ArrayBuffer> | null {
  const hex = value.startsWith('\\x') ? value.slice(2) : null;
  if (hex === null || hex.length % 2 !== 0 || hex.length > MAX_STORED_BYTES * 2) {
    return null;
  }
  if (!/^[0-9a-f]*$/i.test(hex)) {
    return null;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

/** `bytes` unzipped as text, or `null` when they are not gzip. */
async function gunzip(bytes: Uint8Array<ArrayBuffer>): Promise<string | null> {
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  } catch {
    return null;
  }
}

/**
 * The replay of a stored run, by its id (#219). The server keeps each run's replay gzipped; this
 * reads it, unzips it in the browser and checks it as untrusted data. A run of another version of
 * the game is refused before it is unzipped. One request, without the client's own retries: the
 * caller decides whether to try again.
 */
export async function fetchReplay(
  client: Client,
  runId: string,
  gameVersion: string,
): Promise<StoredReplay> {
  if (!RUN_ID.test(runId)) {
    return { ok: false, problem: 'not-found' };
  }
  const { data, error } = await client
    .from('runs')
    .select('game_version,replay')
    .eq('id', runId)
    .limit(1)
    .retry(false);
  if (error !== null) {
    return { ok: false, problem: 'offline' };
  }
  const row = data[0];
  if (row === undefined) {
    return { ok: false, problem: 'not-found' };
  }
  if (row.game_version !== gameVersion) {
    return { ok: false, problem: 'other-version' };
  }
  const bytes = bytesOf(row.replay);
  const text = bytes === null ? null : await gunzip(bytes);
  const parsed = text === null ? null : deserializeReplay(text);
  if (!parsed?.ok) {
    return { ok: false, problem: 'unreadable' };
  }
  return parsed.replay.gameVersion === gameVersion
    ? { ok: true, replay: parsed.replay }
    : { ok: false, problem: 'other-version' };
}
