import { describe, expect, it } from 'vitest';

import { composite, contrastRatio, parseHex, relativeLuminance } from './contrast';

describe('contrast', () => {
  it('parses every hex form the tokens use', () => {
    expect(parseHex('#fff')).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(parseHex('#ff8000')).toEqual({ r: 1, g: 128 / 255, b: 0, a: 1 });
    expect(parseHex('#000c').a).toBeCloseTo(0.8, 2);
    expect(parseHex('#000000a6').a).toBeCloseTo(0.65, 2);
    expect(parseHex('#FFF')).toEqual(parseHex('#fff'));
    expect(() => parseHex('rgb(0 0 0)')).toThrow('Not a hex color');
    expect(() => parseHex('#12345')).toThrow('Not a hex color');
  });

  it('computes WCAG luminance and contrast', () => {
    expect(relativeLuminance(parseHex('#fff'))).toBe(1);
    expect(relativeLuminance(parseHex('#000'))).toBe(0);
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 10);
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 10);
    expect(contrastRatio('#fff', '#fff')).toBe(1);
    // The classic AA boundary: #767676 on white is 4.54:1.
    expect(contrastRatio('#767676', '#fff')).toBeCloseTo(4.54, 1);
  });

  it('composites a translucent color on what is under it', () => {
    expect(composite({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 1, g: 1, b: 1, a: 1 })).toEqual({
      r: 0.5,
      g: 0.5,
      b: 0.5,
      a: 1,
    });
    expect(composite({ r: 1, g: 0, b: 0, a: 0 }, { r: 0, g: 0, b: 1, a: 0 })).toEqual({
      r: 0,
      g: 0,
      b: 0,
      a: 0,
    });

    const overlayOnDark = contrastRatio('#fff', '#000000a6', '#000');
    const overlayOnLight = contrastRatio('#fff', '#000000a6', '#fff');
    expect(overlayOnDark).toBeCloseTo(21, 10);
    expect(overlayOnLight).toBeLessThan(overlayOnDark);
    expect(overlayOnLight).toBeGreaterThan(4.5);
  });
});
