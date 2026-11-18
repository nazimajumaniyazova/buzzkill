// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { DAILY_KEY, dailyBest, recordDailyScore } from './best';

/** A `localStorage` in memory; with `broken`, every call throws. */
function memoryStorage(initial: Record<string, string> = {}, broken = false) {
  const items = new Map(Object.entries(initial));
  const check = (): void => {
    if (broken) {
      throw new Error('SecurityError');
    }
  };
  return {
    items,
    getItem(key: string) {
      check();
      return items.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      check();
      items.set(key, value);
    },
    removeItem(key: string) {
      check();
      items.delete(key);
    },
  };
}

describe('the best daily score of this device (#165)', () => {
  it('is nothing before a daily run of the day', () => {
    expect(dailyBest(memoryStorage(), '2026-11-17')).toBeNull();
    expect(dailyBest(null, '2026-11-17')).toBeNull();
  });

  it('keeps the best score of the day, not the last', () => {
    const storage = memoryStorage();

    recordDailyScore(storage, '2026-11-17', 120);
    recordDailyScore(storage, '2026-11-17', 80);
    recordDailyScore(storage, '2026-11-17', 150);

    expect(dailyBest(storage, '2026-11-17')).toBe(150);
    expect(JSON.parse(storage.items.get(DAILY_KEY) ?? 'null')).toEqual({
      version: 1,
      date: '2026-11-17',
      best: 150,
    });
  });

  it('starts over on a new day, and a score of yesterday is no best of today', () => {
    const storage = memoryStorage();
    recordDailyScore(storage, '2026-11-17', 300);

    expect(dailyBest(storage, '2026-11-18')).toBeNull();
    recordDailyScore(storage, '2026-11-18', 40);
    expect(dailyBest(storage, '2026-11-18')).toBe(40);
  });

  it('reads nothing from broken or foreign data, and never throws', () => {
    const broken = (json: string) => dailyBest(memoryStorage({ [DAILY_KEY]: json }), '2026-11-17');

    expect(broken('{oops')).toBeNull();
    expect(broken('{"version":2,"date":"2026-11-17","best":5}')).toBeNull();
    expect(broken('{"version":1,"date":"2026-11-17","best":-5}')).toBeNull();
    expect(dailyBest(memoryStorage({}, true), '2026-11-17')).toBeNull();
    expect(() => {
      recordDailyScore(memoryStorage({}, true), '2026-11-17', 10);
    }).not.toThrow();
  });
});
