// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import { createFixedTimestep } from './fixed-timestep';

const STEP = 1000 / 60;

describe('createFixedTimestep', () => {
  it('runs one tick per frame when frames arrive at the simulation rate', () => {
    const timestep = createFixedTimestep();

    for (let frame = 0; frame < 600; frame += 1) {
      const { ticks, alpha, droppedMs } = timestep.advance(STEP);

      expect(ticks).toBe(1);
      expect(alpha).toBe(0);
      expect(droppedMs).toBe(0);
    }
  });

  it('runs two ticks per frame at half the simulation rate', () => {
    const timestep = createFixedTimestep();

    expect(timestep.advance(2 * STEP).ticks).toBe(2);
    expect(timestep.advance(2 * STEP).ticks).toBe(2);
  });

  it('spreads 60 ticks over one second of 144 Hz frames, never more than one per frame', () => {
    const timestep = createFixedTimestep();
    let ticks = 0;

    for (let frame = 0; frame < 144; frame += 1) {
      const result = timestep.advance(1000 / 144);
      expect(result.ticks).toBeLessThanOrEqual(1);
      expect(result.alpha).toBeGreaterThanOrEqual(0);
      expect(result.alpha).toBeLessThan(1);
      ticks += result.ticks;
    }

    // The last tick lands exactly on the second boundary; rounding may put it just after.
    expect(ticks).toBeOneOf([59, 60]);
  });

  test.prop([fc.array(fc.double({ min: 0, max: 100, noNaN: true }), { maxLength: 500 })])(
    'accounts for every millisecond: simulated time plus carried time equals elapsed time',
    (frames) => {
      const timestep = createFixedTimestep({ maxTicksPerAdvance: 1_000_000 });
      let elapsed = 0;
      let ticks = 0;

      for (const frame of frames) {
        elapsed += frame;
        const result = timestep.advance(frame);
        ticks += result.ticks;

        expect(result.droppedMs).toBe(0);
        expect(result.alpha).toBeGreaterThanOrEqual(0);
        expect(result.alpha).toBeLessThan(1);
        expect((ticks + result.alpha) * STEP).toBeCloseTo(elapsed, 3);
      }
    },
  );

  test.prop([fc.double({ min: 0, max: 10_000, noNaN: true }), fc.integer({ min: 1, max: 20 })])(
    'never runs more ticks than the cap and reports the backlog it discards',
    (elapsed, maxTicksPerAdvance) => {
      const timestep = createFixedTimestep({ maxTicksPerAdvance });

      const { ticks, alpha, droppedMs } = timestep.advance(elapsed);

      expect(ticks).toBeLessThanOrEqual(maxTicksPerAdvance);
      expect(droppedMs).toBeGreaterThanOrEqual(0);
      if (droppedMs > 0) {
        expect(ticks).toBe(maxTicksPerAdvance);
        expect(alpha).toBe(0);
        expect(ticks * STEP + droppedMs).toBeCloseTo(elapsed, 6);
      } else {
        expect((ticks + alpha) * STEP).toBeCloseTo(elapsed, 6);
      }
    },
  );

  it('catches up after a stall by at most the cap, then runs normally again', () => {
    const timestep = createFixedTimestep();

    const stalled = timestep.advance(1000);
    expect(stalled.ticks).toBe(5);
    expect(stalled.alpha).toBe(0);
    expect(stalled.droppedMs).toBeCloseTo(1000 - 5 * STEP, 6);

    const next = timestep.advance(STEP);
    expect(next.ticks).toBe(1);
    expect(next.droppedMs).toBe(0);
  });

  it('treats a clock that went backwards as no time passed', () => {
    const timestep = createFixedTimestep();

    expect(timestep.advance(-5)).toMatchObject({ ticks: 0, alpha: 0, droppedMs: 0 });
    expect(timestep.advance(STEP).ticks).toBe(1);
  });

  it('rejects a non-finite elapsed time instead of corrupting the accumulator', () => {
    const timestep = createFixedTimestep();

    expect(() => timestep.advance(Number.NaN)).toThrow(RangeError);
    expect(() => timestep.advance(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(timestep.advance(STEP).ticks).toBe(1);
  });

  it('reset forgets the carried time', () => {
    const timestep = createFixedTimestep();
    timestep.advance(0.75 * STEP);

    timestep.reset();

    expect(timestep.advance(0.5 * STEP)).toMatchObject({ ticks: 0, alpha: 0.5 });
  });

  it('reuses one result object between frames so the hot loop does not allocate', () => {
    const timestep = createFixedTimestep();

    expect(timestep.advance(1)).toBe(timestep.advance(1));
  });

  it('exposes the tick length in milliseconds and in seconds', () => {
    const timestep = createFixedTimestep({ hz: 50 });

    expect(timestep.stepMs).toBe(20);
    expect(timestep.stepSeconds).toBe(0.02);
  });

  it('rejects a rate that is not a positive finite number', () => {
    expect(() => createFixedTimestep({ hz: 0 })).toThrow(RangeError);
    expect(() => createFixedTimestep({ hz: -60 })).toThrow(RangeError);
    expect(() => createFixedTimestep({ hz: Number.POSITIVE_INFINITY })).toThrow(RangeError);
  });

  it('rejects a cap that is not a whole number of at least one tick', () => {
    expect(() => createFixedTimestep({ maxTicksPerAdvance: 0 })).toThrow(RangeError);
    expect(() => createFixedTimestep({ maxTicksPerAdvance: 1.5 })).toThrow(RangeError);
  });
});
