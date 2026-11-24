import type { Difficulty } from '@buzzkill/game';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as z from 'zod/mini';

import type { Database } from './database.gen';

/** How many runs a board shows. */
export const BOARD_SIZE = 10;

/** A board (#220): the runs of a difficulty, or of one day of the daily challenge (#165). */
export type Board =
  | { readonly mode: 'classic'; readonly difficulty: Difficulty }
  | { readonly mode: 'daily'; readonly day: string };

/** A run on a board, as the backend sent it. The nickname is untrusted text (#217). */
export interface BoardRow {
  /** The run's id, which fetches its replay (#219). */
  readonly id: string;
  readonly userId: string;
  /** `null` for a player who has not picked one yet. */
  readonly nickname: string | null;
  readonly score: number;
  readonly level: number;
  readonly createdAt: string;
}

/** The player's own best run of a board, at any speed (ADR-0014), with the speed in percent. */
export interface PersonalBest extends Omit<BoardRow, 'nickname'> {
  readonly speed: number;
}

type Client = SupabaseClient<Database>;

const RUN = z.object({
  id: z.string(),
  user_id: z.string(),
  score: z.number(),
  level: z.number(),
  created_at: z.string(),
});
const BOARD_ROW = z.extend(RUN, { nickname: z.nullable(z.string()) });
const PERSONAL_ROW = z.extend(RUN, { speed: z.number() });

/**
 * The rows that read as runs. A row the client cannot read is left out rather than failing the
 * whole board: the backend may be newer than this build.
 */
function readable<T>(rows: readonly unknown[] | null, schema: z.ZodMiniType<T>): T[] {
  const read: T[] = [];
  for (const row of rows ?? []) {
    const parsed = schema.safeParse(row);
    if (parsed.success) {
      read.push(parsed.data);
    }
  }
  return read;
}

/**
 * The top of `board` (#220): each player's best run at 100 %, by score, the earlier run first on
 * a tie, from the `best_runs` view. An answer with an error throws, so that the query shows the
 * board as offline.
 */
export async function fetchBoard(client: Client, board: Board): Promise<BoardRow[]> {
  const query = client
    .from('best_runs')
    .select('id,user_id,nickname,score,level,created_at')
    .eq('mode', board.mode);
  const { data, error } = await (
    board.mode === 'classic'
      ? query.eq('difficulty', board.difficulty)
      : query.eq('daily_date', board.day)
  )
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(BOARD_SIZE)
    // postgrest-js tries a 503 or a failed request again three times, for up to 7 s; TanStack
    // Query has a policy of its own, and two of them would keep the board loading far too long.
    .retry(false);
  if (error !== null) {
    throw new Error(`the board could not be read: ${error.message}`);
  }
  return readable(data, BOARD_ROW).map((row) => ({
    id: row.id,
    userId: row.user_id,
    nickname: row.nickname,
    score: row.score,
    level: row.level,
    createdAt: row.created_at,
  }));
}

/**
 * The best run of `userId` on `board` at any speed, or `null` without one. A slower run never
 * enters a board, but it is the player's own record.
 */
export async function fetchPersonalBest(
  client: Client,
  userId: string,
  board: Board,
): Promise<PersonalBest | null> {
  const query = client
    .from('runs')
    .select('id,user_id,score,level,created_at,speed')
    .eq('user_id', userId)
    .eq('mode', board.mode);
  const { data, error } = await (
    board.mode === 'classic'
      ? query.eq('difficulty', board.difficulty)
      : query.eq('daily_date', board.day)
  )
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .retry(false);
  if (error !== null) {
    throw new Error(`the personal record could not be read: ${error.message}`);
  }
  const [best] = readable(data, PERSONAL_ROW);
  return best === undefined
    ? null
    : {
        id: best.id,
        userId: best.user_id,
        score: best.score,
        level: best.level,
        createdAt: best.created_at,
        speed: best.speed,
      };
}
