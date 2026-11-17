import type { Difficulty } from '../config/difficulty';
import type { GameMode } from '../config/enemies';

/**
 * The daily challenge (#165): one run a day that is the same for everyone. Its seed is a pure
 * function of the date in UTC, so every player, in any time zone, gets the same run until
 * midnight UTC, and the server of stage 8 can check a daily replay's seed against its date.
 */

/** How every daily run starts, whatever the player's settings: by day, at the normal difficulty. */
export const DAILY_RUN = {
  mode: 'day',
  difficulty: 'normal',
} as const satisfies { readonly mode: GameMode; readonly difficulty: Difficulty };

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whether `date` is a real calendar date written as `YYYY-MM-DD`. */
export function isDailyDate(date: string): boolean {
  const match = DATE.exec(date);
  if (match === null) {
    return false;
  }
  const [, year, month, day] = match.map(Number);
  const utc = new Date(Date.UTC(year ?? 0, (month ?? 0) - 1, day ?? 0));
  return utc.getUTCMonth() + 1 === month && utc.getUTCDate() === day;
}

/** The date of `moment` in UTC, as `YYYY-MM-DD`: the day of the daily run it belongs to. */
export function dailyDate(moment: Date): string {
  return moment.toISOString().slice(0, 10);
}

/**
 * The seed of the daily run of `date` (`YYYY-MM-DD`): FNV-1a over the characters, then the
 * finalizer of MurmurHash3, so neighboring days get seeds far apart. Pinned by a test: a change
 * would give every past daily run another seed.
 */
export function dailySeed(date: string): number {
  if (!isDailyDate(date)) {
    throw new RangeError(`dailySeed: expected a date as YYYY-MM-DD, got ${date}`);
  }
  let hash = 0x81_1c_9d_c5;
  for (let i = 0; i < date.length; i += 1) {
    hash = Math.imul(hash ^ date.charCodeAt(i), 0x01_00_01_93);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85_eb_ca_6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2_b2_ae_35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}
