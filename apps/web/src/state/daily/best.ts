import * as z from 'zod/mini';

import type { SettingsStorage } from '../settings/storage';

/**
 * The best score of this device in the daily challenge of one day (#165), for the main menu. The
 * leaderboard of the day comes with the server of stage 8; until then the device keeps only its
 * own best, and only of the latest day it played.
 */

/** Where the best daily score lives in `localStorage`. */
export const DAILY_KEY = 'buzzkill.daily';

const STORED = z.object({
  version: z.literal(1),
  date: z.string(),
  best: z.int().check(z.nonnegative()),
});

type Stored = z.infer<typeof STORED>;

function read(storage: SettingsStorage | null): Stored | null {
  try {
    const json = storage?.getItem(DAILY_KEY) ?? null;
    if (json === null) {
      return null;
    }
    const result = STORED.safeParse(JSON.parse(json));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** The best score of the daily run of `date` on this device, or `null` before one. */
export function dailyBest(storage: SettingsStorage | null, date: string): number | null {
  const stored = read(storage);
  return stored?.date === date ? stored.best : null;
}

/** Keeps `score` when it is the first or the best of the daily run of `date`. Never throws. */
export function recordDailyScore(
  storage: SettingsStorage | null,
  date: string,
  score: number,
): void {
  const best = dailyBest(storage, date);
  if (best !== null && best >= score) {
    return;
  }
  try {
    storage?.setItem(DAILY_KEY, JSON.stringify({ version: 1, date, best: score }));
  } catch {
    // A full or blocked storage loses the best score, never the page.
  }
}
