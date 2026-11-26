import { type AchievementId, ACHIEVEMENTS } from '@buzzkill/game';
import * as z from 'zod/mini';

import { type AccountAchievement, mergeAchievements } from '../state/achievements/merge';
import type { DeviceAchievements } from '../state/achievements/progress';
import type { Backend } from './client';

/**
 * What a sync did:
 * - `merged`: the account's whole set came back, for the device to join;
 * - `skipped`: this browser has no player, so there is no account to join;
 * - `failed`: the backend could not be reached or said no. The device keeps its achievements,
 *   and the next sync sends them again (#221).
 */
type SyncOutcome =
  | { readonly kind: 'merged'; readonly account: readonly AccountAchievement[] }
  | { readonly kind: 'skipped' }
  | { readonly kind: 'failed' };

/** Joins the device's achievements with the account's; never throws. */
export type AchievementSync = (device: DeviceAchievements) => Promise<SyncOutcome>;

const KNOWN: ReadonlySet<string> = new Set(ACHIEVEMENTS.map(({ id }) => id));

const isAchievementId = (id: string): id is AchievementId => KNOWN.has(id);

const ROW = z.object({ achievement_id: z.string(), unlocked_at: z.string() });

/**
 * The rows the game can read, as achievements of the account. Rows are untrusted: one of an
 * achievement this version does not have, or with a time that does not parse, is left out.
 */
function readable(rows: unknown): AccountAchievement[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  const account: AccountAchievement[] = [];
  for (const row of rows) {
    const parsed = ROW.safeParse(row);
    if (!parsed.success || !isAchievementId(parsed.data.achievement_id)) {
      continue;
    }
    const time = Date.parse(parsed.data.unlocked_at);
    if (!Number.isNaN(time)) {
      account.push({ id: parsed.data.achievement_id, unlockedAt: new Date(time).toISOString() });
    }
  }
  return account;
}

/**
 * The sync of this browser's achievements with its player's account (#221), through the
 * `merge_achievements` function of the database: one call sends what the device unlocked and
 * reads back the account's whole set, each at its earlier time.
 *
 * It asks for the session the browser has and never starts one, so it is safe on load: only
 * sending a run makes a player (#217).
 */
export function createAchievementSync(
  backend: Pick<Backend, 'client' | 'player'>,
): AchievementSync {
  return async (device) => {
    try {
      const session = await backend.player.session();
      if (!session.ok) {
        return session.problem === 'signed-out' ? { kind: 'skipped' } : { kind: 'failed' };
      }
      // Against no account, what the account lacks is all the device unlocked.
      const unlocked = mergeAchievements(device, []).toAccount.map(({ id, unlockedAt }) => ({
        achievement_id: id,
        unlocked_at: unlockedAt,
      }));
      const client = await backend.client();
      const { data, error } = await client.rpc('merge_achievements', { unlocked });
      return error === null ? { kind: 'merged', account: readable(data) } : { kind: 'failed' };
    } catch {
      return { kind: 'failed' };
    }
  };
}
