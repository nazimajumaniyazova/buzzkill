// @vitest-environment node
import {
  type AchievementId,
  ACHIEVEMENTS,
  heroUnlocked,
  noProgress,
  unlocked,
} from '@buzzkill/game';
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import { type AccountAchievement, mergeAchievements } from './merge';
import { type DeviceAchievements, noAchievements } from './progress';

const goal = (id: AchievementId): number =>
  ACHIEVEMENTS.find((a) => a.id === id)?.goal ?? Number.NaN;

const EARLY = '2026-11-01T08:00:00.000Z';
const LATE = '2026-11-20T08:00:00.000Z';

/** The device after unlocking `times`, with one count on its way to `swatter`. */
function device(times: Partial<Record<AchievementId, string>>): DeviceAchievements {
  const progress: Record<AchievementId, number> = { ...noProgress(), swatter: 12 };
  for (const id of Object.keys(times) as AchievementId[]) {
    progress[id] = goal(id);
  }
  return { progress, unlockedAt: times };
}

describe('mergeAchievements', () => {
  it('changes nothing between a device and an account that both have nothing', () => {
    expect(mergeAchievements(noAchievements(), [])).toEqual({
      device: noAchievements(),
      toAccount: [],
    });
  });

  it('sends what only the device has unlocked, with the time it was unlocked', () => {
    const merged = mergeAchievements(device({ firstSwat: EARLY }), []);

    expect(merged.device).toEqual(device({ firstSwat: EARLY }));
    expect(merged.toAccount).toEqual([{ id: 'firstSwat', unlockedAt: EARLY }]);
  });

  it('unlocks on the device what only the account has, with its counts at their goal', () => {
    const merged = mergeAchievements(device({}), [{ id: 'swatter', unlockedAt: LATE }]);

    expect(merged.device.progress.swatter).toBe(goal('swatter'));
    expect(merged.device.unlockedAt).toEqual({ swatter: LATE });
    expect(merged.toAccount).toEqual([]);
  });

  it('keeps the earlier time of an achievement unlocked on both, and sends it when the device has it', () => {
    const earlierHere = mergeAchievements(device({ regicide: EARLY }), [
      { id: 'regicide', unlockedAt: LATE },
    ]);
    expect(earlierHere.device.unlockedAt).toEqual({ regicide: EARLY });
    expect(earlierHere.toAccount).toEqual([{ id: 'regicide', unlockedAt: EARLY }]);

    const earlierThere = mergeAchievements(device({ regicide: LATE }), [
      { id: 'regicide', unlockedAt: EARLY },
    ]);
    expect(earlierThere.device.unlockedAt).toEqual({ regicide: EARLY });
    expect(earlierThere.toAccount).toEqual([]);
  });

  it('compares instants, not their text, and writes them in UTC', () => {
    const merged = mergeAchievements(device({ regicide: '2026-11-01T08:00:00.000Z' }), [
      { id: 'regicide', unlockedAt: '2026-11-01T10:30:00+03:00' },
    ]);

    expect(merged.device.unlockedAt).toEqual({ regicide: '2026-11-01T07:30:00.000Z' });
    expect(merged.toAccount).toEqual([]);
  });

  it('takes the earliest of an achievement the account lists twice', () => {
    const merged = mergeAchievements(device({}), [
      { id: 'champion', unlockedAt: LATE },
      { id: 'champion', unlockedAt: EARLY },
    ]);

    expect(merged.device.unlockedAt).toEqual({ champion: EARLY });
  });

  it('unlocks the heroes of what the account has unlocked (#164)', () => {
    const before = device({});
    expect(heroUnlocked('sam', before.progress)).toBe(false);

    const merged = mergeAchievements(before, [{ id: 'regicide', unlockedAt: EARLY }]);

    expect(heroUnlocked('sam', merged.device.progress)).toBe(true);
    expect(heroUnlocked('leo', merged.device.progress)).toBe(false);
  });
});

describe('mergeAchievements, for any device and account', () => {
  const ids = ACHIEVEMENTS.map(({ id }) => id);
  const instant = fc
    .date({
      min: new Date('2026-01-01T00:00:00.000Z'),
      max: new Date('2027-01-01T00:00:00.000Z'),
      noInvalidDate: true,
    })
    .map((date) => date.toISOString());
  const deviceArb = fc
    .tuple(
      fc.tuple(...ACHIEVEMENTS.map(({ goal: g }) => fc.integer({ min: 0, max: g }))),
      fc.array(instant, { minLength: ids.length, maxLength: ids.length }),
    )
    .map(([counts, times]): DeviceAchievements => {
      const progress: Record<AchievementId, number> = { ...noProgress() };
      const unlockedAt: Partial<Record<AchievementId, string>> = {};
      ACHIEVEMENTS.forEach(({ id, goal: g }, i) => {
        progress[id] = counts[i] ?? 0;
        const time = times[i];
        if (progress[id] >= g && time !== undefined) {
          unlockedAt[id] = time;
        }
      });
      return { progress, unlockedAt };
    });
  const accountArb = fc.array(fc.record({ id: fc.constantFrom(...ids), unlockedAt: instant }), {
    maxLength: 12,
  });

  /** The earliest time of each id in `rows`, as the account keeps it. */
  const earliest = (rows: readonly AccountAchievement[]): Map<AchievementId, number> => {
    const times = new Map<AchievementId, number>();
    for (const { id, unlockedAt } of rows) {
      const time = Date.parse(unlockedAt);
      times.set(id, Math.min(time, times.get(id) ?? time));
    }
    return times;
  };

  test.prop([deviceArb, accountArb])(
    'loses nothing: an achievement unlocked on either side is unlocked, at the earlier time',
    (here, there) => {
      const { device: merged } = mergeAchievements(here, there);
      const account = earliest(there);

      for (const { id } of ACHIEVEMENTS) {
        const times = [here.unlockedAt[id], account.get(id)]
          .filter((time) => time !== undefined)
          .map((time) => (typeof time === 'string' ? Date.parse(time) : time));
        if (times.length === 0) {
          expect(merged.unlockedAt[id]).toBeUndefined();
          expect(merged.progress[id]).toBe(here.progress[id]);
        } else {
          expect(unlocked(merged.progress)).toContain(id);
          expect(Date.parse(merged.unlockedAt[id] ?? '')).toBe(Math.min(...times));
        }
        expect(merged.progress[id]).toBeGreaterThanOrEqual(here.progress[id]);
      }
    },
  );

  test.prop([deviceArb, accountArb])(
    'makes one set: the account, once it keeps what is sent, holds what the device holds',
    (here, there) => {
      const { device: merged, toAccount } = mergeAchievements(here, there);
      const account = earliest([...there, ...toAccount]);

      expect(Object.fromEntries([...account].map(([id, time]) => [id, time]))).toEqual(
        Object.fromEntries(
          Object.entries(merged.unlockedAt).map(([id, time]) => [id, Date.parse(time)]),
        ),
      );
    },
  );

  test.prop([deviceArb, accountArb])(
    'is done after once: merging the result again changes and sends nothing',
    (here, there) => {
      const first = mergeAchievements(here, there);
      const again = mergeAchievements(first.device, [...there, ...first.toAccount]);

      expect(again.device).toEqual(first.device);
      expect(again.toAccount).toEqual([]);
    },
  );
});
