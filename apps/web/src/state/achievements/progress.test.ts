// @vitest-environment node
import { ACHIEVEMENTS, noProgress } from '@buzzkill/game';
import { describe, expect, it } from 'vitest';

import {
  ACHIEVEMENTS_KEY,
  ACHIEVEMENTS_VERSION,
  loadProgress,
  mergeProgress,
  parseProgress,
  saveProgress,
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

describe('parseProgress', () => {
  it('reads the counts of the current version and starts the missing ones at zero', () => {
    const parsed = parseProgress({ version: ACHIEVEMENTS_VERSION, progress: { swatter: 42 } });

    expect(parsed).toEqual({ ...noProgress(), swatter: 42 });
  });

  it('mends what is broken: a count that is not a whole number, below zero or past its goal', () => {
    const parsed = parseProgress({
      version: ACHIEVEMENTS_VERSION,
      progress: { swatter: -3, nightShift: 2.5, collector: 'many', regicide: 9, unknown: 7 },
    });

    expect(parsed).toEqual({ ...noProgress(), regicide: goal('regicide') });
    expect(parsed).not.toHaveProperty('unknown');
  });

  it('starts over from what is not progress at all, or of another version', () => {
    expect(parseProgress(undefined)).toEqual(noProgress());
    expect(parseProgress('progress')).toEqual(noProgress());
    expect(parseProgress({ version: ACHIEVEMENTS_VERSION + 1, progress: { swatter: 5 } })).toEqual(
      noProgress(),
    );
  });
});

describe('mergeProgress', () => {
  it('keeps the larger count of each achievement, for the merge with an account in stage 8', () => {
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

describe('loadProgress and saveProgress', () => {
  it('saves the progress with its version and loads it back', () => {
    const storage = memoryStorage();
    const progress = { ...noProgress(), firstSwat: 1, swatter: 7 };

    saveProgress(progress, storage);

    expect(JSON.parse(storage.items.get(ACHIEVEMENTS_KEY) ?? 'null')).toEqual({
      version: ACHIEVEMENTS_VERSION,
      progress,
    });
    expect(loadProgress(storage)).toEqual(progress);
  });

  it('gives no progress without storage, from broken JSON or a storage that throws, and never throws', () => {
    expect(loadProgress(null)).toEqual(noProgress());
    expect(loadProgress(memoryStorage({ [ACHIEVEMENTS_KEY]: '{oops' }))).toEqual(noProgress());
    expect(loadProgress(memoryStorage({}, true))).toEqual(noProgress());
    expect(() => {
      saveProgress(noProgress(), memoryStorage({}, true));
    }).not.toThrow();
  });
});
