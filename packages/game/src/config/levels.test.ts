import { describe, expect, it } from 'vitest';

import { DAY_ENEMIES, NIGHT_ENEMIES } from './enemies';
import { type LevelConfig, LEVELS } from './levels';

/** The campaign through its type, so the checks read numbers rather than literal types. */
const CAMPAIGN: readonly LevelConfig[] = LEVELS;

const isCount = (value: number) => Number.isInteger(value) && value > 0;

describe('LEVELS', () => {
  it('make a campaign of six levels (ADR-0017)', () => {
    expect(CAMPAIGN).toHaveLength(6);
  });

  it('send whole waves at a positive pace, with a calm before each, never slower than 1×', () => {
    const wrong = CAMPAIGN.flatMap((level, index) =>
      level.waves.length > 0 &&
      isCount(level.breakTicks) &&
      level.speedScale >= 1 &&
      level.waves.every((wave) => isCount(wave.count) && isCount(wave.intervalTicks))
        ? []
        : [index + 1],
    );

    expect(wrong).toEqual([]);
  });

  it('weigh the enemies of either time of day, with at least one that can come', () => {
    // A level plays by day or by night (ADR-0017), so a wave weighs the sets by position. The type
    // of `weights` holds three numbers, one for each enemy of either set.
    expect(DAY_ENEMIES).toHaveLength(3);
    expect(NIGHT_ENEMIES).toHaveLength(3);
    const weights = CAMPAIGN.flatMap((level) =>
      level.waves.flatMap((wave) => (wave.weights === undefined ? [] : [wave.weights])),
    );

    expect(weights.length).toBeGreaterThan(0);
    expect(
      weights.filter(
        (set) => set.some((weight) => weight < 0) || !set.some((weight) => weight > 0),
      ),
    ).toEqual([]);
  });

  it('never get slower from one level to the next', () => {
    const speeds = CAMPAIGN.map((level) => level.speedScale);

    expect(speeds).toEqual(speeds.toSorted((a, b) => a - b));
  });

  it('change the time of day once, after the third level, and never after the last', () => {
    expect(CAMPAIGN.map((level) => level.timeChangesAfter)).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
    ]);
  });
});
