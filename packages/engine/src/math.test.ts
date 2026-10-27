import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { clamp } from './math';

const finite = fc.double({ noNaN: true, noDefaultInfinity: true });

describe('clamp', () => {
  test.prop([finite, finite, finite])('returns a value inside the range', (value, a, b) => {
    const [min, max] = a <= b ? [a, b] : [b, a];

    const result = clamp(value, min, max);

    expect(result).toBeGreaterThanOrEqual(min);
    expect(result).toBeLessThanOrEqual(max);
  });

  test.prop([finite, finite, finite])('is idempotent', (value, a, b) => {
    const [min, max] = a <= b ? [a, b] : [b, a];

    const once = clamp(value, min, max);

    expect(clamp(once, min, max)).toBe(once);
  });

  test('rejects an inverted range instead of swapping the bounds', () => {
    expect(() => clamp(0, 1, -1)).toThrow(RangeError);
  });
});
