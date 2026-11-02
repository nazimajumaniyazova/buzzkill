// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import {
  applyCanvasFit,
  type CanvasLike,
  computeCanvasFit,
  fitContain,
  type Size,
} from './fit-canvas';

const positiveSize = fc.record<Size>({
  width: fc.integer({ min: 1, max: 4000 }),
  height: fc.integer({ min: 1, max: 4000 }),
});
const viewport = fc.record<Size>({
  width: fc.integer({ min: 0, max: 4000 }),
  height: fc.integer({ min: 0, max: 4000 }),
});
const ratio = fc.constantFrom(0.5, 1, 1.25, 1.5, 2, 3);

describe('fitContain', () => {
  it('limits by width for wide content in a tall container and by height otherwise', () => {
    expect(fitContain({ width: 1600, height: 900 }, { width: 800, height: 800 })).toEqual({
      width: 800,
      height: 450,
    });
    expect(fitContain({ width: 900, height: 1600 }, { width: 800, height: 800 })).toEqual({
      width: 450,
      height: 800,
    });
    expect(fitContain({ width: 400, height: 300 }, { width: 800, height: 600 })).toEqual({
      width: 800,
      height: 600,
    });
  });

  test.prop([positiveSize, viewport])(
    'fits inside the container, keeps the aspect ratio and touches one side',
    (content, container) => {
      const fitted = fitContain(content, container);

      expect(fitted.width).toBeLessThanOrEqual(container.width + 1e-9);
      expect(fitted.height).toBeLessThanOrEqual(container.height + 1e-9);
      expect(fitted.width * content.height).toBeCloseTo(fitted.height * content.width, 6);
      const touches =
        Math.abs(fitted.width - container.width) < 1e-9 ||
        Math.abs(fitted.height - container.height) < 1e-9;
      expect(touches).toBe(true);
    },
  );

  it('rejects content without area and non-finite sizes', () => {
    expect(() => fitContain({ width: 0, height: 10 }, { width: 10, height: 10 })).toThrow(
      RangeError,
    );
    expect(() => fitContain({ width: 10, height: 10 }, { width: Number.NaN, height: 10 })).toThrow(
      RangeError,
    );
  });
});

describe('computeCanvasFit', () => {
  const logical = { width: 1024, height: 768 };

  it('gives one backing pixel per CSS pixel on a standard display', () => {
    const fit = computeCanvasFit({ logical, viewport: logical, devicePixelRatio: 1 });

    expect(fit).toEqual({
      cssWidth: 1024,
      cssHeight: 768,
      pixelWidth: 1024,
      pixelHeight: 768,
      scale: 1,
    });
  });

  it('doubles the backing store on a 2x display and caps a 3x display at 2x by default', () => {
    const two = computeCanvasFit({ logical, viewport: logical, devicePixelRatio: 2 });
    const three = computeCanvasFit({ logical, viewport: logical, devicePixelRatio: 3 });

    expect([two.pixelWidth, two.pixelHeight, two.scale]).toEqual([2048, 1536, 2]);
    expect(three).toEqual(two);
    expect(
      computeCanvasFit({ logical, viewport: logical, devicePixelRatio: 3, maxDevicePixelRatio: 3 })
        .pixelWidth,
    ).toBe(3072);
  });

  it('letterboxes a wider viewport and keeps the CSS size on whole device pixels', () => {
    const fit = computeCanvasFit({
      logical,
      viewport: { width: 1500, height: 600 },
      devicePixelRatio: 1.5,
    });

    expect(fit.pixelHeight).toBe(900);
    expect(fit.pixelWidth).toBe(1200);
    expect(fit.cssWidth).toBe(800);
    expect(fit.cssHeight).toBe(600);
    expect(fit.scale).toBeCloseTo(1200 / 1024, 12);
  });

  test.prop([positiveSize, viewport, ratio])(
    'always fits the viewport with whole pixels and the logical aspect ratio',
    (size, space, devicePixelRatio) => {
      const fit = computeCanvasFit({ logical: size, viewport: space, devicePixelRatio });
      const effective = Math.min(devicePixelRatio, 2);

      expect(Number.isInteger(fit.pixelWidth) && fit.pixelWidth >= 1).toBe(true);
      expect(Number.isInteger(fit.pixelHeight) && fit.pixelHeight >= 1).toBe(true);
      expect(fit.cssWidth).toBe(fit.pixelWidth / effective);
      expect(fit.cssHeight).toBe(fit.pixelHeight / effective);
      if (fit.pixelWidth > 1 && fit.pixelHeight > 1) {
        expect(fit.cssWidth).toBeLessThanOrEqual(space.width);
        expect(fit.cssHeight).toBeLessThanOrEqual(space.height);
      }
      expect(Math.abs(fit.pixelHeight - size.height * fit.scale)).toBeLessThanOrEqual(1);
      expect(fit.scale).toBe(fit.pixelWidth / size.width);
    },
  );

  it('rejects a ratio that is not a positive number', () => {
    expect(() => computeCanvasFit({ logical, viewport: logical, devicePixelRatio: 0 })).toThrow(
      RangeError,
    );
    expect(() =>
      computeCanvasFit({ logical, viewport: logical, devicePixelRatio: 1, maxDevicePixelRatio: 0 }),
    ).toThrow(RangeError);
  });
});

describe('applyCanvasFit', () => {
  function fakeCanvas(width: number, height: number) {
    let writes = 0;
    const canvas: CanvasLike = {
      get width() {
        return width;
      },
      set width(value: number) {
        width = value;
        writes += 1;
      },
      get height() {
        return height;
      },
      set height(value: number) {
        height = value;
        writes += 1;
      },
      style: { width: '', height: '' },
    };
    return {
      canvas,
      get writes() {
        return writes;
      },
    };
  }

  it('sets the backing store and the CSS size', () => {
    const { canvas } = fakeCanvas(0, 0);

    applyCanvasFit(canvas, {
      cssWidth: 800,
      cssHeight: 450,
      pixelWidth: 1600,
      pixelHeight: 900,
      scale: 2,
    });

    expect([canvas.width, canvas.height]).toEqual([1600, 900]);
    expect(canvas.style).toEqual({ width: '800px', height: '450px' });
  });

  it('leaves the attributes alone when they already match, so the canvas is not wiped', () => {
    const fake = fakeCanvas(1600, 900);

    applyCanvasFit(fake.canvas, {
      cssWidth: 800,
      cssHeight: 450,
      pixelWidth: 1600,
      pixelHeight: 900,
      scale: 2,
    });

    expect(fake.writes).toBe(0);
  });
});
