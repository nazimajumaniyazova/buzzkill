import { WORLD } from '@buzzkill/game';
import { describe, expect, it } from 'vitest';

import { COMFORTABLE_SCALE, suggestsLandscape } from './landscape';

describe('suggestsLandscape', () => {
  it('suggests turning a phone held upright: the world is a third of its size there', () => {
    // A Pixel 7 and an iPhone SE, upright.
    expect(suggestsLandscape(WORLD, { width: 412, height: 915 })).toBe(true);
    expect(suggestsLandscape(WORLD, { width: 375, height: 667 })).toBe(true);
  });

  it('suggests nothing once the phone is sideways', () => {
    expect(suggestsLandscape(WORLD, { width: 915, height: 412 })).toBe(false);
    expect(suggestsLandscape(WORLD, { width: 667, height: 375 })).toBe(false);
  });

  it('suggests nothing on a screen where the world is big enough upright, like a tablet', () => {
    expect(suggestsLandscape(WORLD, { width: 820, height: 1180 })).toBe(false);
  });

  it('suggests nothing where turning would not make the world bigger', () => {
    // A small phone sideways: the world is small, but upright it would be smaller still.
    expect(suggestsLandscape(WORLD, { width: 568, height: 320 })).toBe(false);
  });

  it('draws the line at half the size of the world', () => {
    expect(COMFORTABLE_SCALE).toBe(0.5);
    // Upright, these fit the world at exactly half its size, and at a little less.
    expect(suggestsLandscape(WORLD, { width: 640, height: 1000 })).toBe(false);
    expect(suggestsLandscape(WORLD, { width: 639, height: 1000 })).toBe(true);
  });

  it('suggests nothing for a window of no size, such as a hidden one', () => {
    expect(suggestsLandscape(WORLD, { width: 0, height: 0 })).toBe(false);
  });
});
