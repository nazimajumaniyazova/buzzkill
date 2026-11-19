import { describe, expect, it } from 'vitest';

import { type HeroConfig, HEROES, type HeroId } from '../config/rules';
import { ACHIEVEMENTS, noProgress } from './achievements';
import { heroUnlocked } from './heroes';

const ALL = Object.keys(HEROES) as HeroId[];

describe('the heroes unlocked by achievements (#164)', () => {
  it('opens Mike and Julie from the start, and no one else', () => {
    expect(ALL.filter((heroId) => heroUnlocked(heroId, noProgress()))).toEqual(['male', 'female']);
  });

  it('opens Sam with the regicide and Leo with the champion', () => {
    expect(HEROES.sam.unlockedBy).toBe('regicide');
    expect(HEROES.leo.unlockedBy).toBe('champion');

    const queenBeaten = { ...noProgress(), regicide: 1 };
    expect(ALL.filter((heroId) => heroUnlocked(heroId, queenBeaten))).toEqual([
      'male',
      'female',
      'sam',
    ]);

    const won = { ...queenBeaten, champion: 1 };
    expect(ALL.filter((heroId) => heroUnlocked(heroId, won))).toEqual(ALL);
  });

  it('keeps a hero locked until the achievement reaches its goal', () => {
    const goals = Object.fromEntries(ACHIEVEMENTS.map(({ id, goal }) => [id, goal]));
    for (const heroId of ALL) {
      const config: HeroConfig = HEROES[heroId];
      const by = config.unlockedBy;
      if (by === undefined) {
        continue;
      }
      const goal = goals[by] ?? 1;

      expect(heroUnlocked(heroId, { ...noProgress(), [by]: goal - 1 })).toBe(false);
      expect(heroUnlocked(heroId, { ...noProgress(), [by]: goal })).toBe(true);
    }
  });
});
