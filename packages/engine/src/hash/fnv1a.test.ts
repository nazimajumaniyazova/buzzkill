import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import { createFnv1a } from './fnv1a';

function hashText(text: string): number {
  const hasher = createFnv1a();
  for (const char of text) {
    hasher.byte(char.charCodeAt(0));
  }
  return hasher.digest();
}

describe('createFnv1a', () => {
  it('matches the published FNV-1a 32-bit test vectors', () => {
    expect(hashText('')).toBe(0x81_1c_9d_c5);
    expect(hashText('a')).toBe(0xe4_0c_29_2c);
    expect(hashText('foobar')).toBe(0xbf_9c_f9_68);
  });

  it('mixes 32-bit integers little-endian, negative ones as two complement', () => {
    expect(createFnv1a().uint32(0x64_63_62_61).digest()).toBe(hashText('abcd'));
    expect(createFnv1a().uint32(-1).digest()).toBe(createFnv1a().uint32(0xff_ff_ff_ff).digest());
  });

  it('mixes the raw bits of floats, so 0 and -0 differ', () => {
    expect(createFnv1a().float64(0).hex()).not.toBe(createFnv1a().float64(-0).hex());
    expect(createFnv1a().float64(1.5).digest()).toBe(
      // 1.5 is 0x3ff8000000000000: low word 0, high word 0x3ff80000.
      createFnv1a().uint32(0).uint32(0x3f_f8_00_00).digest(),
    );
  });

  it('formats the digest as 8 hex digits', () => {
    expect(createFnv1a().hex()).toBe('811c9dc5');
    expect(createFnv1a().byte(0).hex()).toMatch(/^[0-9a-f]{8}$/);
  });

  test.prop([fc.double(), fc.double()])('depends on the order of the values', (x, y) => {
    fc.pre(!Object.is(x, y) && !(Number.isNaN(x) && Number.isNaN(y)));
    const forward = createFnv1a().float64(x).float64(y).digest();
    const backward = createFnv1a().float64(y).float64(x).digest();
    // Two distinct inputs collide with probability 2^-32, far below what a test run can hit.
    expect(forward).not.toBe(backward);
  });
});
