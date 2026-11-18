import { describe, expect, it } from 'vitest';

import { DAILY_RUN, dailyDate, dailySeed, isDailyDate } from './daily';

describe('dailyDate', () => {
  it('is the date in UTC, whatever the zone the moment was written in', () => {
    // The same instant written in three zones: one daily run for everyone.
    const instants = [
      new Date('2026-11-17T23:30:00Z'),
      new Date('2026-11-18T08:30:00+09:00'),
      new Date('2026-11-17T15:30:00-08:00'),
    ];

    expect(instants.map(dailyDate)).toEqual(['2026-11-17', '2026-11-17', '2026-11-17']);
  });

  it('changes at midnight UTC, and not a millisecond before', () => {
    expect(dailyDate(new Date('2026-11-17T23:59:59.999Z'))).toBe('2026-11-17');
    expect(dailyDate(new Date('2026-11-18T00:00:00.000Z'))).toBe('2026-11-18');
    expect(dailyDate(new Date('2026-12-31T23:59:59.999Z'))).toBe('2026-12-31');
    expect(dailyDate(new Date('2027-01-01T00:00:00.000Z'))).toBe('2027-01-01');
  });
});

describe('dailySeed', () => {
  it('is the same for the whole UTC day and a 32-bit unsigned integer', () => {
    const seed = dailySeed('2026-11-17');

    expect(dailySeed(dailyDate(new Date('2026-11-17T00:00:00Z')))).toBe(seed);
    expect(dailySeed(dailyDate(new Date('2026-11-17T23:59:59Z')))).toBe(seed);
    expect(Number.isInteger(seed) && seed >= 0 && seed <= 0xff_ff_ff_ff).toBe(true);
  });

  it('differs from day to day across a year, around a midnight and a new year', () => {
    const seeds = new Set<number>();
    const day = new Date('2026-01-01T12:00:00Z');
    for (let i = 0; i < 366; i += 1) {
      seeds.add(dailySeed(dailyDate(day)));
      day.setUTCDate(day.getUTCDate() + 1);
    }

    expect(seeds.size).toBe(366);
    expect(dailySeed('2026-12-31')).not.toBe(dailySeed('2027-01-01'));
  });

  it('is pinned: a change would give every past daily run another seed', () => {
    expect(dailySeed('2026-11-17')).toMatchInlineSnapshot(`1917294966`);
  });

  it('refuses what is not a date', () => {
    expect(() => dailySeed('17.11.2026')).toThrow(RangeError);
    expect(isDailyDate('2026-02-30')).toBe(false);
    expect(isDailyDate('2026-02-28')).toBe(true);
  });
});

describe('DAILY_RUN', () => {
  it('starts every daily run the same way: by day, at the normal difficulty', () => {
    expect(DAILY_RUN).toEqual({ mode: 'day', difficulty: 'normal' });
  });
});
