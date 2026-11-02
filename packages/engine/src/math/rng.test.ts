// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import { createRng, type RngState } from './rng';

const seed = fc.integer({ min: 0, max: 0xff_ff_ff_ff });

/**
 * Straight transcription of the widely circulated sfc32 and splitmix32 snippets (bryc's
 * collection of JavaScript PRNGs), including the customary 15 discarded outputs after seeding.
 * The production code is structured differently; agreeing with this on thousands of outputs shows
 * that it implements the same generator.
 */
function referenceSequence(seedValue: number, length: number): number[] {
  let s = seedValue | 0;
  const splitmix = (): number => {
    s = (s + 0x9e3779b9) | 0;
    let t = s ^ (s >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    t = t ^ (t >>> 15);
    return t >>> 0;
  };
  let a = splitmix() | 0;
  let b = splitmix() | 0;
  let c = splitmix() | 0;
  let d = splitmix() | 0;
  const sfc32 = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
  for (let i = 0; i < 15; i += 1) {
    sfc32();
  }
  return Array.from({ length }, sfc32);
}

function take(rng: { nextUint32(): number }, count: number): number[] {
  return Array.from({ length: count }, () => rng.nextUint32());
}

describe('createRng', () => {
  test.prop([seed])('yields the same sequence for the same seed', (value) => {
    expect(take(createRng(value), 200)).toEqual(take(createRng(value), 200));
  });

  test.prop([seed])('agrees with the reference sfc32 + splitmix32 transcription', (value) => {
    expect(take(createRng(value), 500)).toEqual(referenceSequence(value, 500));
  });

  it('pins the first outputs of a few seeds against accidental changes', () => {
    // Known-answer values recorded from this implementation; a change here is a change of every
    // replay ever recorded and needs a formatVersion bump (ADR-0009).
    expect(take(createRng(0), 4)).toEqual([1664216021, 3479288465, 3033988455, 3613202701]);
    expect(take(createRng(42), 4)).toEqual([890322987, 2796912455, 4258306155, 1242540590]);
    expect(take(createRng(0xff_ff_ff_ff), 4)).toEqual([
      3823104220, 1358629326, 3404600419, 385091411,
    ]);
  });

  it('gives unrelated streams for neighboring seeds', () => {
    const zero = take(createRng(0), 10);
    const one = take(createRng(1), 10);

    expect(zero).not.toEqual(one);
    expect(new Set([...zero, ...one]).size).toBe(20);
  });

  test.prop([seed, fc.nat({ max: 100 }), fc.nat({ max: 100 })])(
    'continues identically from a restored state',
    (value, before, after) => {
      const rng = createRng(value);
      take(rng, before);
      const state = rng.getState();
      const expected = take(rng, after);

      rng.setState(state);

      expect(take(rng, after)).toEqual(expected);
    },
  );

  it('returns a copy of the state, not a live view', () => {
    const rng = createRng(7);
    const state = rng.getState();
    rng.nextUint32();

    expect(rng.getState()).not.toEqual(state);
    expect(state.every((word) => Number.isInteger(word) && word >= 0 && word < 2 ** 32)).toBe(true);
  });

  test.prop([seed])('nextFloat stays in [0, 1)', (value) => {
    const rng = createRng(value);
    for (let i = 0; i < 100; i += 1) {
      const u = rng.nextFloat();
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });

  test.prop([seed, fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: 0, max: 2000 })])(
    'nextInt stays within the inclusive bounds',
    (value, min, span) => {
      const rng = createRng(value);
      const max = min + span;
      for (let i = 0; i < 50; i += 1) {
        const n = rng.nextInt(min, max);
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(min);
        expect(n).toBeLessThanOrEqual(max);
      }
    },
  );

  it('nextInt covers the whole range, including both ends', () => {
    const rng = createRng(3);
    const hits = new Set<number>();
    for (let i = 0; i < 1000; i += 1) {
      hits.add(rng.nextInt(0, 9));
    }

    expect([...hits].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(rng.nextInt(5, 5)).toBe(5);
    expect(rng.nextInt(0, 2 ** 32 - 1)).toBeLessThan(2 ** 32);
  });

  it('is roughly uniform', () => {
    const rng = createRng(42);
    let sum = 0;
    for (let i = 0; i < 10_000; i += 1) {
      sum += rng.nextFloat();
    }

    expect(sum / 10_000).toBeGreaterThan(0.47);
    expect(sum / 10_000).toBeLessThan(0.53);
  });

  test.prop([seed])('chance is never true at 0 and always true at 1', (value) => {
    const rng = createRng(value);
    for (let i = 0; i < 20; i += 1) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });

  it('rejects seeds outside the 32-bit range and non-integers', () => {
    expect(() => createRng(-1)).toThrow(RangeError);
    expect(() => createRng(2 ** 32)).toThrow(RangeError);
    expect(() => createRng(1.5)).toThrow(RangeError);
    expect(() => createRng(Number.NaN)).toThrow(RangeError);
  });

  it('rejects malformed arguments instead of returning garbage', () => {
    const rng = createRng(1);

    expect(() => rng.nextInt(5, 4)).toThrow(RangeError);
    expect(() => rng.nextInt(0.5, 4)).toThrow(RangeError);
    expect(() => rng.nextInt(0, 2 ** 32)).toThrow(RangeError);
    expect(() => rng.chance(1.01)).toThrow(RangeError);
    expect(() => rng.chance(Number.NaN)).toThrow(RangeError);
    expect(() => {
      rng.setState([1, 2, 3, -4] as unknown as RngState);
    }).toThrow(RangeError);
  });
});
