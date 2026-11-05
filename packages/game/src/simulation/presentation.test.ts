import { describe, expect, it } from 'vitest';

import { animationFrame, parallaxOffset } from './presentation';

describe('parallaxOffset', () => {
  it('scrolls left by the scroll speed per tick and wraps after one width', () => {
    expect(parallaxOffset(0, 1280)).toBe(0);
    expect(parallaxOffset(10, 1280)).toBe(-10);
    expect(parallaxOffset(1280, 1280)).toBe(0);
    expect(parallaxOffset(1300, 1280)).toBe(-20);
  });

  it('moves far layers slower', () => {
    expect(parallaxOffset(100, 1280, 0.5)).toBe(-50);
  });

  it('rejects a width that is not positive', () => {
    expect(() => parallaxOffset(1, 0)).toThrow(RangeError);
  });
});

describe('animationFrame', () => {
  it('advances one frame every frameTicks ticks from the spawn tick and loops', () => {
    expect(animationFrame(10, 10, 6, 2)).toBe(0);
    expect(animationFrame(13, 10, 6, 2)).toBe(1);
    expect(animationFrame(22, 10, 6, 2)).toBe(0);
    expect(animationFrame(5, 10, 6, 2)).toBe(0);
  });

  it('rejects a frame count or frame time below one', () => {
    expect(() => animationFrame(0, 0, 0, 1)).toThrow(RangeError);
    expect(() => animationFrame(0, 0, 1, 0.5)).toThrow(RangeError);
  });
});
