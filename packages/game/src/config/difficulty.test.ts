// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import { enemyLivesWith, intInRange, paced, valueInRange } from '../simulation/rules';
import { DIFFICULTIES, DIFFICULTY_IDS, type DifficultyConfig } from './difficulty';
import { DAY_ENEMIES, NIGHT_ENEMIES } from './enemies';
import { type LevelConfig, LEVELS } from './levels';
import { RULES } from './rules';

const PRESETS: readonly DifficultyConfig[] = DIFFICULTY_IDS.map((id) => DIFFICULTIES[id]);
const CAMPAIGN: readonly LevelConfig[] = LEVELS;
/** Every wave of the campaign with the calm before it: `[breakTicks, intervalTicks]`. */
const WAVES = CAMPAIGN.flatMap((level) =>
  level.waves.map((wave) => [level.breakTicks, wave.intervalTicks] as const),
);
const ENEMIES = [...DAY_ENEMIES, ...NIGHT_ENEMIES];
const roll = fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true });

/** Each preset next to the harder one after it: easy with normal, normal with hard. */
const pairs = PRESETS.slice(1).map((harder, index) => [PRESETS[index] ?? harder, harder] as const);

describe('DIFFICULTIES', () => {
  it('go from easy to hard, and normal keeps the numbers of the 2023 game', () => {
    expect(DIFFICULTY_IDS).toEqual(['easy', 'normal', 'hard']);
    expect(DIFFICULTIES.normal).toEqual({
      enemySpeed: 1,
      pace: 1,
      enemyLives: 0,
      bossHealth: 1,
      lives: RULES.lives,
      ammo: { start: RULES.ammo.start, max: RULES.ammo.max },
    });
  });

  it('never make an easier preset harder in any of its numbers', () => {
    const harderThanNext = pairs.filter(
      ([easier, harder]) =>
        easier.enemySpeed > harder.enemySpeed ||
        easier.pace < harder.pace ||
        easier.enemyLives > harder.enemyLives ||
        easier.bossHealth > harder.bossHealth ||
        easier.lives < harder.lives ||
        easier.ammo.start < harder.ammo.start ||
        easier.ammo.max < harder.ammo.max,
    );

    expect(harderThanNext).toEqual([]);
  });

  test.prop([fc.constantFrom(...WAVES)])(
    'leave at least as many ticks between enemies on an easier preset, in every wave',
    ([breakTicks, intervalTicks]) => {
      for (const [easier, harder] of pairs) {
        expect(paced(intervalTicks, easier.pace)).toBeGreaterThanOrEqual(
          paced(intervalTicks, harder.pace),
        );
        expect(paced(breakTicks, easier.pace)).toBeGreaterThanOrEqual(
          paced(breakTicks, harder.pace),
        );
      }
    },
  );

  test.prop([fc.constantFrom(...ENEMIES), roll, roll])(
    'send no faster and no tougher enemies on an easier preset, whatever the rolls',
    (enemy, speedRoll, livesRoll) => {
      for (const [easier, harder] of pairs) {
        const speed = valueInRange(enemy.speed, speedRoll);
        expect(speed * easier.enemySpeed).toBeLessThanOrEqual(speed * harder.enemySpeed);
        const lives = intInRange(enemy.lives, livesRoll);
        expect(enemyLivesWith(lives, easier.enemyLives)).toBeLessThanOrEqual(
          enemyLivesWith(lives, harder.enemyLives),
        );
      }
    },
  );
});
