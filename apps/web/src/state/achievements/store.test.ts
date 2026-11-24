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
});
