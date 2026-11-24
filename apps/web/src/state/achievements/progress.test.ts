// @vitest-environment node
import { ACHIEVEMENTS, noProgress } from '@buzzkill/game';
import { describe, expect, it } from 'vitest';

import {
  ACHIEVEMENTS_KEY,
  ACHIEVEMENTS_VERSION,
  loadAchievements,
  mergeProgress,
  noAchievements,
  parseAchievements,
  saveAchievements,
} from './progress';

/** A `localStorage` in memory; with `broken`, every call throws, as in a sandboxed frame. */
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

const goal = (id: string): number => ACHIEVEMENTS.find((a) => a.id === id)?.goal ?? Number.NaN;

/** The moment of loading in these tests: what an achievement unlocked at an unknown time gets. */
const NOW = '2026-11-23T10:00:00.000Z';

describe('parseAchievements', () => {
  it('reads the counts and the times of the current version, and starts the missing counts at zero', () => {
    const parsed = parseAchievements(
      {
        version: ACHIEVEMENTS_VERSION,
        progress: { swatter: 42, firstSwat: 1 },
        unlockedAt: { firstSwat: '2026-11-01T08:30:00.000Z' },
      },
      NOW,
    );

    expect(parsed).toEqual({
      progress: { ...noProgress(), swatter: 42, firstSwat: 1 },
      unlockedAt: { firstSwat: '2026-11-01T08:30:00.000Z' },
    });
  });

  it('mends what is broken: a count that is not a whole number, below zero or past its goal', () => {
    const parsed = parseAchievements(
      {
        version: ACHIEVEMENTS_VERSION,
        progress: { swatter: -3, nightShift: 2.5, collector: 'many', regicide: 9, unknown: 7 },
        unlockedAt: { regicide: '2026-11-02T00:00:00.000Z' },
      },
      NOW,
    );

    expect(parsed.progress).toEqual({ ...noProgress(), regicide: goal('regicide') });
    expect(parsed.progress).not.toHaveProperty('unknown');
  });

  it('gives an unlocked achievement without a readable time the moment of loading', () => {
    const parsed = parseAchievements(
      {
        version: ACHIEVEMENTS_VERSION,
        progress: { firstSwat: 1, regicide: 1, champion: 1 },
        unlockedAt: { regicide: 'yesterday', champion: 17 },
      },
      NOW,
    );

    expect(parsed.unlockedAt).toEqual({ firstSwat: NOW, regicide: NOW, champion: NOW });
  });

  it('writes each time as an ISO instant in UTC', () => {
    const parsed = parseAchievements(
      {
        version: ACHIEVEMENTS_VERSION,
        progress: { firstSwat: 1 },
        unlockedAt: { firstSwat: '2026-11-01T11:30:00+03:00' },
      },
      NOW,
    );

    expect(parsed.unlockedAt).toEqual({ firstSwat: '2026-11-01T08:30:00.000Z' });
  });

  it('keeps no time for an achievement that is not unlocked, or that the game no longer has', () => {
    const parsed = parseAchievements(
      {
        version: ACHIEVEMENTS_VERSION,
        progress: { swatter: 3 },
        unlockedAt: { swatter: '2026-11-01T00:00:00.000Z', retired: '2026-11-01T00:00:00.000Z' },
      },
      NOW,
    );

    expect(parsed.unlockedAt).toEqual({});
  });

  it('takes the counts of version 1, whose achievements already unlocked get the moment of loading', () => {
    const parsed = parseAchievements({ version: 1, progress: { firstSwat: 1, swatter: 7 } }, NOW);

    expect(parsed).toEqual({
      progress: { ...noProgress(), firstSwat: 1, swatter: 7 },
      unlockedAt: { firstSwat: NOW },
    });
  });

  it('starts over from what is not progress at all, or of an unknown version', () => {
    expect(parseAchievements(undefined, NOW)).toEqual(noAchievements());
    expect(parseAchievements('progress', NOW)).toEqual(noAchievements());
    expect(parseAchievements({ version: 1, progress: 'all' }, NOW)).toEqual(noAchievements());
    expect(
      parseAchievements({ version: ACHIEVEMENTS_VERSION + 1, progress: { swatter: 5 } }, NOW),
    ).toEqual(noAchievements());
  });
});

describe('mergeProgress', () => {
  it('keeps the larger count of each achievement', () => {
    const here = { ...noProgress(), swatter: 40, regicide: 1 };
    const there = { ...noProgress(), swatter: 90, collector: 3 };

    expect(mergeProgress(here, there)).toEqual({
      ...noProgress(),
      swatter: 90,
      regicide: 1,
      collector: 3,
    });
  });
});

describe('loadAchievements and saveAchievements', () => {
  it('saves the counts and the times with their version and loads them back', () => {
    const storage = memoryStorage();
    const device = {
      progress: { ...noProgress(), firstSwat: 1, swatter: 7 },
      unlockedAt: { firstSwat: '2026-11-01T08:30:00.000Z' },
    };

    saveAchievements(device, storage);

    expect(JSON.parse(storage.items.get(ACHIEVEMENTS_KEY) ?? 'null')).toEqual({
      version: ACHIEVEMENTS_VERSION,
      ...device,
    });
    expect(loadAchievements(storage, NOW)).toEqual(device);
  });

  it('saves only the counts and the times, whatever else the object holds', () => {
    const storage = memoryStorage();

    // The state of the achievements store, which also holds what a run earned last.
    const state = { ...noAchievements(), earned: { ids: ['firstSwat'], serial: 1 } };
    saveAchievements(state, storage);

    expect(JSON.parse(storage.items.get(ACHIEVEMENTS_KEY) ?? 'null')).toEqual({
      version: ACHIEVEMENTS_VERSION,
      ...noAchievements(),
    });
  });

  it('gives nothing without storage, from broken JSON or a storage that throws, and never throws', () => {
    expect(loadAchievements(null, NOW)).toEqual(noAchievements());
    expect(loadAchievements(memoryStorage({ [ACHIEVEMENTS_KEY]: '{oops' }), NOW)).toEqual(
      noAchievements(),
    );
    expect(loadAchievements(memoryStorage({}, true), NOW)).toEqual(noAchievements());
    expect(() => {
      saveAchievements(noAchievements(), memoryStorage({}, true));
    }).not.toThrow();
  });
});
