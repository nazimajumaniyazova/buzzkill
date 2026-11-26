import type { SupabaseClient } from '@supabase/supabase-js';
import * as z from 'zod/mini';

import type { Database } from './database.gen';
import type { NicknameSaved } from './nickname';

type Client = SupabaseClient<Database>;

const NICKNAME_ROW = z.object({ nickname: z.string() });

/**
 * The player's nickname, or `null` without one (#217). It throws when the backend cannot answer,
 * so the query that asks can say so; the client does not retry on its own.
 */
export async function fetchNickname(client: Client, userId: string): Promise<string | null> {
  const { data, error } = await client
    .from('profiles')
    .select('nickname')
    .eq('id', userId)
    .limit(1)
    .retry(false);
  if (error !== null) {
    throw new Error(`the nickname cannot be read: ${error.message}`);
  }
  const row = NICKNAME_ROW.safeParse(data[0]);
  return row.success ? row.data.nickname : null;
}

/** No answer or a server error is the backend out of reach; any other refusal is a no. */
const failureOf = (status: number): NicknameSaved =>
  status === 0 || status >= 500
    ? { ok: false, problem: 'offline' }
    : { ok: false, problem: 'unavailable' };

/**
 * Saves the player's nickname (#217), already checked by `checkNickname`; the database checks it
 * again. A player may insert a profile's id and nickname but update only the nickname, so this
 * renames the profile the player has, and creates it when there is none: two requests at most,
 * never an upsert, which would write the id again.
 */
export async function saveNickname(
  client: Client,
  userId: string,
  nickname: string,
): Promise<NicknameSaved> {
  try {
    const renamed = await client
      .from('profiles')
      .update({ nickname })
      .eq('id', userId)
      .select('id');
    if (renamed.error !== null) {
      return failureOf(renamed.status);
    }
    if (renamed.data.length > 0) {
      return { ok: true };
    }
    const created = await client.from('profiles').insert({ id: userId, nickname });
    return created.error === null ? { ok: true } : failureOf(created.status);
  } catch {
    return { ok: false, problem: 'offline' };
  }
}
