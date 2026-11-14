// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import { RULES } from '../config/rules';
import {
  addCapped,
  ammoAfterTick,
  enemyLivesWith,
  healthAfterHit,
  intInRange,
  livesAfterHit,
  otherTime,
  paced,
  pickWeighted,
  scoreAfterKill,
  statusFor,
  timeAfterLevel,
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

  it('decides the run: lost at no lives, even when the level is done; otherwise the level decides', () => {
    expect(statusFor(5, false, false)).toBe('playing');
    expect(statusFor(5, true, false)).toBe('levelCleared');
    expect(statusFor(1, true, true)).toBe('won');
    expect(statusFor(0, true, true)).toBe('lost');
    expect(statusFor(0, false, false)).toBe('lost');
  });

  it('turns day into night and night into day', () => {
    expect(otherTime('day')).toBe('night');
    expect(otherTime('night')).toBe('day');
  });

  it('gives the time of the next level: the other one after a level that changes it', () => {
    // The third level changes the time (ADR-0017); the others keep it.
    expect(timeAfterLevel(1, 'day')).toBe('day');
    expect(timeAfterLevel(3, 'day')).toBe('night');
    expect(timeAfterLevel(3, 'night')).toBe('day');
    expect(timeAfterLevel(4, 'night')).toBe('night');
  });

  it('follows the campaign it is given', () => {
    const level = { breakTicks: 1, speedScale: 1, waves: [] };
    const levels = [
      { ...level, timeChangesAfter: true },
      { ...level, timeChangesAfter: false },
    ];

    expect(timeAfterLevel(1, 'day', levels)).toBe('night');
    expect(timeAfterLevel(2, 'night', levels)).toBe('night');
  });

  test.prop([fc.integer({ min: 0, max: RULES.ammo.max }), fc.nat({ max: 100_000 })])(
    'ammo comes back one round every 12 ticks and never exceeds the maximum',
    (ammo, tick) => {
      const next = ammoAfterTick(ammo, tick);
      expect(next).toBeLessThanOrEqual(RULES.ammo.max);
      expect(next - ammo).toBe(tick > 0 && tick % 12 === 0 && ammo < RULES.ammo.max ? 1 : 0);
    },
  );

  it('refills ammo only up to the maximum it is given', () => {
    expect(ammoAfterTick(39, 12, 40)).toBe(40);
    expect(ammoAfterTick(40, 12, 40)).toBe(40);
  });

  it('adds a power-up up to its cap, and never takes away what is already above it', () => {
    expect(addCapped(20, 15, 50)).toBe(35);
    expect(addCapped(45, 15, 50)).toBe(50);
    expect(addCapped(5, 1, 5)).toBe(5);
    expect(addCapped(4, 1, 5)).toBe(5);
    expect(addCapped(60, 15, 50)).toBe(60);
  });

  test.prop([fc.nat({ max: 100 }), fc.nat({ max: 50 }), fc.nat({ max: 100 })])(
    'a capped gain never lowers a value and never passes the cap from below',
    (value, gain, cap) => {
      const next = addCapped(value, gain, cap);
      expect(next).toBeGreaterThanOrEqual(value);
      expect(next).toBeLessThanOrEqual(Math.max(value, cap));
      expect(next).toBe(value >= cap ? value : Math.min(value + gain, cap));
    },
  );

  it('paces a number of ticks by a factor, to a whole tick and never below one', () => {
    expect(paced(90, 1)).toBe(90);
    expect(paced(90, 1.3)).toBe(117);
    expect(paced(26, 0.8)).toBe(21);
    expect(paced(1, 0.1)).toBe(1);
  });

  test.prop([fc.integer({ min: 1, max: 1000 }), fc.double({ min: 0.1, max: 3, noNaN: true })])(
    'a slower pace never leaves fewer ticks',
    (ticks, pace) => {
      expect(paced(ticks, pace * 1.1)).toBeGreaterThanOrEqual(paced(ticks, pace));
    },
  );

  it("adds the difficulty's lives to an enemy's, never below one", () => {
    expect(enemyLivesWith(3, 1)).toBe(4);
    expect(enemyLivesWith(5, -1)).toBe(4);
    expect(enemyLivesWith(1, -1)).toBe(1);
  });

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
