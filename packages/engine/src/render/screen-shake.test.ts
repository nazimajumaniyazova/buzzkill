// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import { createRng } from '../math/rng';
import {
  type Camera,
  coverZoom,
  createScreenShake,
  IDENTITY_CAMERA,
  type ScreenShake,
  type ScreenShakeOptions,
} from './screen-shake';

const PLAY_AREA = { width: 1280, height: 720 };

const OPTIONS: ScreenShakeOptions = {
  rng: createRng(1),
  maxOffset: 10,
  maxAngle: 0.02,
  decay: 0.02,
  frequency: 0.4,
  ...PLAY_AREA,
};

const shake = (options: Partial<ScreenShakeOptions> = {}): ScreenShake =>
  createScreenShake({ ...OPTIONS, rng: createRng(1), ...options });

/** A copy, since the shake hands out the same camera object every time. */
const at = (screenShake: ScreenShake, time: number): Camera => ({ ...screenShake.camera(time) });

describe('createScreenShake', () => {
  it('holds still without trauma', () => {
    const screenShake = shake();

    expect(screenShake.trauma).toBe(0);
    expect(at(screenShake, 3.7)).toEqual(IDENTITY_CAMERA);
  });

  it('adds trauma up to 1, and ignores what is not more than nothing', () => {
    const screenShake = shake();

    screenShake.add(0.5);
    screenShake.add(0.25);
    expect(screenShake.trauma).toBe(0.75);
    screenShake.add(0.5);
    expect(screenShake.trauma).toBe(1);
    screenShake.add(-2);
    screenShake.add(Number.NaN);
    expect(screenShake.trauma).toBe(1);
  });

  it('loses trauma steadily over time, down to none, and not in no time', () => {
    const screenShake = shake();
    screenShake.add(0.5);

    screenShake.update(10);
    expect(screenShake.trauma).toBeCloseTo(0.3, 12);
    screenShake.update(0);
    screenShake.update(-5);
    expect(screenShake.trauma).toBeCloseTo(0.3, 12);
    screenShake.update(100);
    expect(screenShake.trauma).toBe(0);
    expect(at(screenShake, 1)).toEqual(IDENTITY_CAMERA);
  });

  it('shakes by the square of the trauma: half the trauma, a quarter of the reach', () => {
    const full = shake();
    const half = shake();
    full.add(1);
    half.add(0.5);

    for (const time of [0.3, 2.9, 17.5, 40.2]) {
      const strong = at(full, time);
      const mild = at(half, time);
      expect(mild.x).toBeCloseTo(strong.x / 4, 12);
      expect(mild.y).toBeCloseTo(strong.y / 4, 12);
      expect(mild.angle).toBeCloseTo(strong.angle / 4, 12);
    }
  });

  it('moves smoothly: a little more time, a little more shake', () => {
    const screenShake = shake();
    screenShake.add(1);

    let previous = at(screenShake, 0);
    for (let time = 0.05; time < 30; time += 0.05) {
      const camera = at(screenShake, time);
      // At 0.4 knots a tick, 0.05 ticks moves the noise at most a fraction of its range.
      expect(Math.abs(camera.x - previous.x)).toBeLessThan(0.1 * OPTIONS.maxOffset);
      expect(Math.abs(camera.angle - previous.angle)).toBeLessThan(0.1 * OPTIONS.maxAngle);
      previous = camera;
    }
  });

  it('moves the three directions apart, from its own seed', () => {
    const one = shake({ rng: createRng(1) });
    const same = shake({ rng: createRng(1) });
    const other = shake({ rng: createRng(2) });
    for (const screenShake of [one, same, other]) {
      screenShake.add(1);
    }

    const camera = at(one, 5.5);
    expect(at(same, 5.5)).toEqual(camera);
    expect(at(other, 5.5)).not.toEqual(camera);
    expect(camera.x / OPTIONS.maxOffset).not.toBeCloseTo(camera.y / OPTIONS.maxOffset, 6);
  });

  it('clears its trauma at once', () => {
    const screenShake = shake();
    screenShake.add(1);

    screenShake.clear();

    expect(screenShake.trauma).toBe(0);
    expect(at(screenShake, 2)).toEqual(IDENTITY_CAMERA);
  });

  it('gives the same camera object every time, so a frame allocates nothing', () => {
    const screenShake = shake();
    screenShake.add(1);

    expect(screenShake.camera(1)).toBe(screenShake.camera(2));
  });

  test.prop([
    fc.double({ min: 0, max: 1, noNaN: true }),
    fc.double({ min: 0, max: 1e4, noNaN: true }),
  ])('stays within its reach and zooms in just enough to cover the play area', (trauma, time) => {
    const screenShake = shake();
    screenShake.add(trauma);

    const { x, y, angle, zoom } = at(screenShake, time);
    const reach = trauma * trauma;
    expect(Math.abs(x)).toBeLessThanOrEqual(OPTIONS.maxOffset * reach + 1e-9);
    expect(Math.abs(y)).toBeLessThanOrEqual(OPTIONS.maxOffset * reach + 1e-9);
    expect(Math.abs(angle)).toBeLessThanOrEqual(OPTIONS.maxAngle * reach + 1e-12);
    expect(zoom).toBe(coverZoom(PLAY_AREA.width, PLAY_AREA.height, x, y, angle));
  });

  it.each([
    ['a negative reach', { maxOffset: -1 }],
    ['a rotation that is not a number', { maxAngle: Number.NaN }],
    ['no decay', { decay: 0 }],
    ['no frequency', { frequency: 0 }],
    ['a play area of no size', { width: 0 }],
  ])('rejects %s', (_, change) => {
    expect(() => shake(change)).toThrow(RangeError);
  });
});

describe('coverZoom', () => {
  it('is 1 for a still camera', () => {
    expect(coverZoom(1280, 720, 0, 0, 0)).toBe(1);
  });

  it('zooms in by twice the offset over the side it opens', () => {
    expect(coverZoom(1280, 720, 0, 9, 0)).toBeCloseTo(1 + 18 / 720, 12);
    expect(coverZoom(1280, 720, -16, 0, 0)).toBeCloseTo(1 + 32 / 1280, 12);
  });

  test.prop([
    fc.double({ min: -20, max: 20, noNaN: true }),
    fc.double({ min: -20, max: 20, noNaN: true }),
    fc.double({ min: -0.05, max: 0.05, noNaN: true }),
  ])('keeps every corner of the play area inside the moved scene', (x, y, angle) => {
    const width = 1280;
    const height = 720;
    const zoom = coverZoom(width, height, x, y, angle);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    expect(zoom).toBeGreaterThanOrEqual(1);
    for (const [cornerX, cornerY] of [
      [0, 0],
      [width, 0],
      [0, height],
      [width, height],
    ] as const) {
      // Back through the camera: undo the offset, the rotation and the zoom about the center.
      const dx = cornerX - width / 2 - x;
      const dy = cornerY - height / 2 - y;
      const sceneX = (cos * dx + sin * dy) / zoom;
      const sceneY = (-sin * dx + cos * dy) / zoom;
      expect(Math.abs(sceneX)).toBeLessThanOrEqual(width / 2 + 1e-9);
      expect(Math.abs(sceneY)).toBeLessThanOrEqual(height / 2 + 1e-9);
    }
  });
});
