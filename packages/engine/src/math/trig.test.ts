// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import { cos, sin } from './trig';

const angle = fc.double({ min: -10_000, max: 10_000, noNaN: true });

describe('sin and cos', () => {
  // The tests compare against Math.sin, which is allowed in the engine and its tests; the ban
  // applies to the simulation in packages/game.
  test.prop([angle])('sin matches Math.sin to 1e-10 on [-10000, 10000]', (x) => {
    expect(Math.abs(sin(x) - Math.sin(x))).toBeLessThan(1e-10);
  });

  test.prop([angle])('cos matches Math.cos to 1e-10 on [-10000, 10000]', (x) => {
    expect(Math.abs(cos(x) - Math.cos(x))).toBeLessThan(1e-10);
  });

  test.prop([angle])('stays within [-1, 1]', (x) => {
    expect(Math.abs(sin(x))).toBeLessThanOrEqual(1);
    expect(Math.abs(cos(x))).toBeLessThanOrEqual(1);
  });

  test.prop([angle])('is periodic and odd or even like the real functions', (x) => {
    expect(sin(x + 2 * Math.PI)).toBeCloseTo(sin(x), 8);
    expect(sin(-x)).toBeCloseTo(-sin(x), 12);
    expect(cos(-x)).toBeCloseTo(cos(x), 8);
  });

  it('hits the exact values at 0', () => {
    expect(sin(0)).toBe(0);
    expect(cos(0)).toBe(1);
  });

  it('returns the same bits for the same input', () => {
    // Trivially true in one engine; the guarantee across engines comes from using only exactly
    // specified operations, which this test documents rather than proves.
    expect(sin(1.2345)).toBe(sin(1.2345));
    expect(Object.is(sin(-0), -0)).toBe(true);
  });

  it('returns NaN for non-finite input, like Math.sin', () => {
    expect(sin(Number.NaN)).toBeNaN();
    expect(sin(Number.POSITIVE_INFINITY)).toBeNaN();
    expect(cos(Number.NEGATIVE_INFINITY)).toBeNaN();
  });
});
