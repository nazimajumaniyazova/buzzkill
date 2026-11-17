// @vitest-environment node
import { noProgress } from '@buzzkill/game';
import { describe, expect, it, vi } from 'vitest';

import { createAchievementsStore } from './store';

describe('createAchievementsStore', () => {
  it('starts from the progress it is given, with nothing earned', () => {
    const progress = { ...noProgress(), swatter: 3 };

    expect(createAchievementsStore(progress).getState()).toEqual({
      progress,
      earned: { ids: [], serial: 0 },
    });
  });

  it('keeps the progress a run counts, and numbers each report of something earned', () => {
    const store = createAchievementsStore(noProgress());
    const listener = vi.fn();
    store.subscribe(listener);

    const counted = { ...noProgress(), swatter: 1 };
    store.send({ type: 'counted', progress: counted, earned: [] });
    expect(store.getState()).toEqual({ progress: counted, earned: { ids: [], serial: 0 } });

    const swatted = { ...counted, firstSwat: 1 };
    store.send({ type: 'counted', progress: swatted, earned: ['firstSwat'] });
    expect(store.getState().earned).toEqual({ ids: ['firstSwat'], serial: 1 });

    const more = { ...swatted, swatter: 2 };
    store.send({ type: 'counted', progress: more, earned: [] });
    // What was earned stays the same object, so a reader of it alone renders only for news.
    expect(store.getState().earned).toEqual({ ids: ['firstSwat'], serial: 1 });
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
