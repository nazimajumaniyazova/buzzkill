import { describe, expect, it } from 'vitest';

import type { Context2DLike } from './renderer';
import { createCanvasTintBuffer, type TintCanvas } from './tint-buffer';

const CONTEXT: Context2DLike<unknown> = {
  setTransform: () => undefined,
  clearRect: () => undefined,
  fillRect: () => undefined,
  fillText: () => undefined,
  drawImage: () => undefined,
  fillStyle: '',
  globalAlpha: 1,
  font: '',
  textAlign: '',
  textBaseline: '',
  globalCompositeOperation: 'source-over',
};

const canvas = (context: Context2DLike<unknown> | null): TintCanvas<unknown> => ({
  width: 300,
  height: 150,
  getContext: () => context,
});

describe('createCanvasTintBuffer', () => {
  it("draws on the canvas's 2D context and hands the canvas itself out as the image", () => {
    const target = canvas(CONTEXT);

    const buffer = createCanvasTintBuffer(target);

    expect(buffer?.context).toBe(CONTEXT);
    expect(buffer?.image).toBe(target);
  });

  it('starts at one pixel, grows to the largest size asked for, and never shrinks', () => {
    const target = canvas(CONTEXT);
    const buffer = createCanvasTintBuffer(target);
    expect([target.width, target.height]).toEqual([1, 1]);

    buffer?.ensureSize(120, 80);
    buffer?.ensureSize(60, 200);
    buffer?.ensureSize(10.2, 10);

    expect([target.width, target.height]).toEqual([120, 200]);
    buffer?.ensureSize(120.5, 200);
    expect([target.width, target.height]).toEqual([121, 200]);
  });

  it('gives nothing when the canvas has no 2D context', () => {
    expect(createCanvasTintBuffer(canvas(null))).toBeNull();
  });
});
