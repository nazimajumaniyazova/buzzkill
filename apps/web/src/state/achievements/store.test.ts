// @vitest-environment node
import { noProgress } from '@buzzkill/game';
import { describe, expect, it, vi } from 'vitest';

import { noAchievements } from './progress';
import { createAchievementsStore } from './store';

const FIRST = '2026-11-23T10:00:00.000Z';
const LATER = '2026-11-23T10:05:00.000Z';

describe('createAchievementsStore', () => {
  it('starts from the achievements of the device, with nothing earned', () => {
    const device = {
      progress: { ...noProgress(), swatter: 3, firstSwat: 1 },
      unlockedAt: { firstSwat: FIRST },
    };

    expect(createAchievementsStore(device).getState()).toEqual({
      ...device,
      earned: { ids: [], serial: 0 },
    });
  });

  it('keeps the progress a run counts, and numbers each report of something earned', () => {
    const store = createAchievementsStore(noAchievements());
    const listener = vi.fn();
    store.subscribe(listener);

    const counted = { ...noProgress(), swatter: 1 };
    store.send({ type: 'counted', progress: counted, earned: [], at: FIRST });
    expect(store.getState()).toEqual({
      progress: counted,
      unlockedAt: {},
      earned: { ids: [], serial: 0 },
    });

    const swatted = { ...counted, firstSwat: 1 };
    store.send({ type: 'counted', progress: swatted, earned: ['firstSwat'], at: FIRST });
    expect(store.getState().earned).toEqual({ ids: ['firstSwat'], serial: 1 });

    const more = { ...swatted, swatter: 2 };
    store.send({ type: 'counted', progress: more, earned: [], at: LATER });
    // What was earned stays the same object, so a reader of it alone renders only for news.
    expect(store.getState().earned).toEqual({ ids: ['firstSwat'], serial: 1 });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('notes when each achievement was earned, and keeps the first time (#221)', () => {
    const store = createAchievementsStore(noAchievements());
    const swatted = { ...noProgress(), firstSwat: 1 };

    store.send({ type: 'counted', progress: swatted, earned: ['firstSwat'], at: FIRST });
    expect(store.getState().unlockedAt).toEqual({ firstSwat: FIRST });

    const queen = { ...swatted, regicide: 1 };
    store.send({ type: 'counted', progress: queen, earned: ['firstSwat', 'regicide'], at: LATER });
    expect(store.getState().unlockedAt).toEqual({ firstSwat: FIRST, regicide: LATER });
  });

  it("joins the account's achievements, merged with what the device has now (#221)", () => {
    const store = createAchievementsStore({
      progress: { ...noProgress(), swatter: 3, firstSwat: 1 },
      unlockedAt: { firstSwat: LATER },
    });
    const listener = vi.fn();
    store.subscribe(listener);

    store.send({
      type: 'merged',
      account: [
        { id: 'firstSwat', unlockedAt: FIRST },
        { id: 'regicide', unlockedAt: LATER },
      ],
    });

    expect(store.getState()).toEqual({
      progress: { ...noProgress(), swatter: 3, firstSwat: 1, regicide: 1 },
      unlockedAt: { firstSwat: FIRST, regicide: LATER },
      // Nothing was earned here: the account had it already.
      earned: { ids: [], serial: 0 },
    });
    expect(listener).toHaveBeenCalledTimes(1);

    // The same account again changes nothing.
    store.send({ type: 'merged', account: [{ id: 'regicide', unlockedAt: LATER }] });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps what a merge brought while a run counts from the progress it started with', () => {
    const store = createAchievementsStore(noAchievements());
    // The run starts from no progress; meanwhile the account brings the queen's defeat.
    store.send({ type: 'merged', account: [{ id: 'regicide', unlockedAt: FIRST }] });

    const run = { ...noProgress(), swatter: 1, regicide: 1 };
    store.send({ type: 'counted', progress: run, earned: ['regicide'], at: LATER });

    expect(store.getState().progress).toEqual({ ...noProgress(), swatter: 1, regicide: 1 });
    expect(store.getState().unlockedAt).toEqual({ regicide: FIRST });
    // It was unlocked already, so no toast tells of it again.
    expect(store.getState().earned).toEqual({ ids: [], serial: 0 });

    const lower = { ...noProgress(), swatter: 0 };
    store.send({ type: 'counted', progress: lower, earned: [], at: LATER });
    expect(store.getState().progress).toMatchObject({ swatter: 1, regicide: 1 });
  });
});
