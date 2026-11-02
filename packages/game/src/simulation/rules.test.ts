// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import { RULES } from '../config/rules';
import {
  ammoAfterTick,
  healthAfterHit,
  intInRange,
  livesAfterHit,
  pickWeighted,
  scoreAfterKill,
  spawnIntervalAt,
  statusFor,
  valueInRange,
  waveStep,
} from './rules';

const roll = fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true });

describe('game rules', () => {
  test.prop([fc.integer({ min: 0, max: 10_000 }), fc.integer({ min: -100, max: 100 })])(
    'the score never decreases',
    (score, value) => {
      expect(scoreAfterKill(score, value)).toBeGreaterThanOrEqual(score);
    },
  );

  test.prop([fc.integer({ min: 0, max: RULES.lives })])(
    'lives stay within [0, start] and drop by one per hit',
    (lives) => {
      const next = livesAfterHit(lives);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThanOrEqual(RULES.lives);
      expect(next).toBe(Math.max(0, lives - 1));
    },
  );

  test.prop([fc.integer({ min: 0, max: 10 })])('health never goes below zero', (health) => {
    expect(healthAfterHit(health)).toBe(Math.max(0, health - 1));
  });

  it('decides the run: lost at no lives (even with a winning score), won above 100', () => {
    expect(statusFor(0, 5)).toBe('playing');
    expect(statusFor(100, 5)).toBe('playing');
    expect(statusFor(101, 5)).toBe('won');
    expect(statusFor(500, 0)).toBe('lost');
  });

  test.prop([fc.integer({ min: 0, max: RULES.ammo.max }), fc.nat({ max: 100_000 })])(
    'ammo comes back one round every 12 ticks and never exceeds the maximum',
    (ammo, tick) => {
      const next = ammoAfterTick(ammo, tick);
      expect(next).toBeLessThanOrEqual(RULES.ammo.max);
      expect(next - ammo).toBe(tick > 0 && tick % 12 === 0 && ammo < RULES.ammo.max ? 1 : 0);
    },
  );

  it('keeps the spawn interval for 20 s, then ramps it down to the minimum', () => {
    expect(spawnIntervalAt(102, 1199)).toBe(102);
    expect(spawnIntervalAt(102, 1200)).toBe(96);
    expect(spawnIntervalAt(26, 5000)).toBe(24);
    expect(spawnIntervalAt(24, 5000)).toBe(24);
  });

  test.prop([fc.integer({ min: 24, max: 200 }), fc.nat({ max: 100_000 })])(
    'the spawn interval never grows and never drops below the minimum',
    (interval, tick) => {
      const next = spawnIntervalAt(interval, tick);
      expect(next).toBeLessThanOrEqual(interval);
      expect(next).toBeGreaterThanOrEqual(RULES.spawn.minIntervalTicks);
    },
  );

  test.prop([roll])('range helpers stay inside their ranges', (value) => {
    const x = valueInRange({ min: 1.5, max: 4.5 }, value);
    expect(x).toBeGreaterThanOrEqual(1.5);
    expect(x).toBeLessThanOrEqual(4.5);
    const n = intInRange({ min: 1, max: 5 }, value);
    expect(Number.isInteger(n) && n >= 1 && n <= 5).toBe(true);
  });

  it('maps rolls onto weights in order', () => {
    const weights = [3, 3, 4];
    expect(pickWeighted(weights, 0)).toBe(0);
    expect(pickWeighted(weights, 0.29)).toBe(0);
    expect(pickWeighted(weights, 0.3)).toBe(1);
    expect(pickWeighted(weights, 0.6)).toBe(2);
    expect(pickWeighted(weights, 0.999_999)).toBe(2);
    expect(pickWeighted([0, 2, 0], 0.5)).toBe(1);
    expect(pickWeighted([1, 1, 0], 1 - Number.EPSILON)).toBe(1);
  });

  test.prop([fc.array(fc.nat({ max: 10 }), { minLength: 1, maxLength: 8 }), roll])(
    'always picks an item with a positive weight',
    (weights, value) => {
      fc.pre(weights.some((weight) => weight > 0));
      const index = pickWeighted(weights, value);
      expect(weights[index]).toBeGreaterThan(0);
    },
  );

  it('rejects weights with nothing to pick', () => {
    expect(() => pickWeighted([], 0.5)).toThrow(RangeError);
    expect(() => pickWeighted([0, 0], 0.5)).toThrow(RangeError);
  });

  it('moves along the wave with the deterministic sine', () => {
    expect(waveStep(2, 0)).toBe(0);
    expect(waveStep(2, Math.PI / 2)).toBeCloseTo(2, 12);
  });
});
