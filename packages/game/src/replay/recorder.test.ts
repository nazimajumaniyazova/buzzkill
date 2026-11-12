import { describe, expect, it } from 'vitest';

import { createReplayRecorder } from './recorder';

const OPTIONS = {
  gameVersion: '0.1.0',
  seed: 7,
  heroId: 'male',
  mode: 'day',
  difficulty: 'normal',
} as const;

describe('createReplayRecorder', () => {
  it('stores only the changes of the mask, as ticks since the previous change', () => {
    const recorder = createReplayRecorder(OPTIONS);
    const masks = [0, 0, 4, 4, 4, 6, 6, 0, 0, 0];

    masks.forEach((down, index) => {
      recorder.recordInput(index + 1, down);
    });

    expect(recorder.replay()).toEqual({
      formatVersion: 2,
      ...OPTIONS,
      inputs: [3, 4, 3, 6, 2, 0],
    });
  });

  it('records nothing while nothing changes', () => {
    const recorder = createReplayRecorder(OPTIONS);
    for (let tick = 1; tick <= 1000; tick += 1) {
      recorder.recordInput(tick, 0);
    }

    expect(recorder.replay().inputs).toEqual([]);
  });

  it('returns a copy that later recording does not change', () => {
    const recorder = createReplayRecorder(OPTIONS);
    recorder.recordInput(1, 1);
    const before = recorder.replay();

    recorder.recordInput(2, 2);

    expect(before.inputs).toEqual([1, 1]);
    expect(recorder.replay().inputs).toEqual([1, 1, 1, 2]);
  });

  it('rejects ticks that do not grow and masks outside the replay actions', () => {
    const recorder = createReplayRecorder(OPTIONS);
    recorder.recordInput(5, 1);

    expect(() => {
      recorder.recordInput(5, 1);
    }).toThrow(RangeError);
    expect(() => {
      recorder.recordInput(6.5, 1);
    }).toThrow(RangeError);
    expect(() => {
      recorder.recordInput(6, 8);
    }).toThrow(/outside the replay actions/);
    expect(() => {
      recorder.recordInput(6, -1);
    }).toThrow(RangeError);
    expect(() => {
      recorder.recordInput(6, 0.5);
    }).toThrow(RangeError);
  });
});
