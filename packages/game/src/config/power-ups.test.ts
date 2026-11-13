import { describe, expect, it } from 'vitest';

import { DAY_ENEMIES, NIGHT_ENEMIES } from './enemies';
import { POWER_UP_RULES, POWER_UPS, type PowerUpConfig } from './power-ups';
import { WORLD } from './rules';

const KINDS: readonly PowerUpConfig[] = POWER_UPS;
const total = KINDS.reduce((sum, { weight }) => sum + weight, 0);
const shareOf = (kind: PowerUpConfig['kind']): number =>
  (KINDS.find((config) => config.kind === kind)?.weight ?? 0) / total;

describe('POWER_UPS', () => {
  it('has each kind once, in the order of the roll, with the sprite of the art', () => {
    expect(KINDS.map(({ kind, sprite }) => [kind, sprite.sheet])).toEqual([
      ['ammo', 'power-ammo'],
      ['life', 'power-life'],
      ['shield', 'power-shield'],
      ['rapidFire', 'power-rapid-fire'],
    ]);
  });

  it('drops ammo most often and a life least often, as the owner approved (4 : 1 : 2 : 2)', () => {
    expect(shareOf('ammo')).toBeCloseTo(4 / 9);
    expect(shareOf('life')).toBeCloseTo(1 / 9);
    expect(shareOf('shield')).toBeCloseTo(2 / 9);
    expect(shareOf('rapidFire')).toBeCloseTo(2 / 9);
  });

  it('gives 15 rounds, one life, a shield for 10 s and rapid fire for 8 s at 10 shots a second', () => {
    const seconds = (ticks: number) => ticks / WORLD.ticksPerSecond;
    // The order is pinned by the first test.
    const [ammo, life, shield, rapidFire] = POWER_UPS;

    expect(ammo.rounds).toBe(15);
    expect(life.lives).toBe(1);
    expect(seconds(shield.durationTicks)).toBe(10);
    expect(seconds(rapidFire.durationTicks)).toBe(8);
    expect(WORLD.ticksPerSecond / rapidFire.intervalTicks).toBe(10);
  });

  it('drops from 12 % of destroyed enemies and drifts no faster than the slowest enemy', () => {
    const slowest = Math.min(...[...DAY_ENEMIES, ...NIGHT_ENEMIES].map(({ speed }) => speed.min));

    expect(POWER_UP_RULES.dropChance).toBe(0.12);
    expect(POWER_UP_RULES.size).toBe(32);
    expect(POWER_UP_RULES.speed).toBeGreaterThan(0);
    expect(POWER_UP_RULES.speed).toBeLessThanOrEqual(slowest);
  });
});
