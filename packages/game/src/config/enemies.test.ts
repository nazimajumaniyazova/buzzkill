import { describe, expect, it } from 'vitest';

import { DAY_ENEMIES, ENEMY_SETS, type EnemyConfig, NIGHT_ENEMIES } from './enemies';

const ALL: readonly EnemyConfig[] = [...DAY_ENEMIES, ...NIGHT_ENEMIES];

describe('enemy configs', () => {
  it('has three kinds per mode, with unique ids across both sets', () => {
    expect(ENEMY_SETS.day).toHaveLength(3);
    expect(ENEMY_SETS.night).toHaveLength(3);
    expect(new Set(ALL.map((enemy) => enemy.id)).size).toBe(ALL.length);
  });

  it('keeps the 2023 spawn split of 30 %, 30 % and 40 % in each mode', () => {
    for (const set of [DAY_ENEMIES, NIGHT_ENEMIES]) {
      const total = set.reduce((sum, enemy) => sum + enemy.weight, 0);
      expect(set.map((enemy) => enemy.weight / total)).toEqual([0.3, 0.3, 0.4]);
    }
  });

  it.each(ALL)('$id has valid ranges, a positive hitbox and a sprite sheet', (enemy) => {
    expect(enemy.speed.min).toBeGreaterThan(0);
    expect(enemy.speed.max).toBeGreaterThanOrEqual(enemy.speed.min);
    expect(Number.isInteger(enemy.lives.min) && enemy.lives.min >= 1).toBe(true);
    expect(Number.isInteger(enemy.lives.max) && enemy.lives.max >= enemy.lives.min).toBe(true);
    expect(enemy.wave.amplitude.max).toBeGreaterThanOrEqual(enemy.wave.amplitude.min);
    expect(enemy.wave.angleSpeed.max).toBeGreaterThanOrEqual(enemy.wave.angleSpeed.min);
    expect(enemy.hitbox.width).toBeGreaterThan(0);
    expect(enemy.hitbox.height).toBeGreaterThan(0);
    expect(enemy.hitbox.width).toBe(enemy.sprite.frameWidth * 0.5);
    expect(enemy.sprite.sheet).not.toBe('');
  });
});
