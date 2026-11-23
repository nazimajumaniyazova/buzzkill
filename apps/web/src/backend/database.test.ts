// @vitest-environment node
import type { Difficulty, GameMode, GameStatus, HeroId } from '@buzzkill/game';
import { describe, expectTypeOf, it } from 'vitest';

import type { Database } from './database.gen';

type Enums = Database['public']['Enums'];
type Run = Database['public']['Tables']['runs']['Row'];

/**
 * The database names the game's values as enums (#215), so the generated types hold the same
 * unions as `@buzzkill/game`. A hero or a difficulty added on one side only fails `typecheck`.
 */
describe('the database types', () => {
  it('know the difficulties, heroes and times of day of the game', () => {
    expectTypeOf<Enums['difficulty']>().toEqualTypeOf<Difficulty>();
    expectTypeOf<Enums['hero_id']>().toEqualTypeOf<HeroId>();
    expectTypeOf<Enums['time_of_day']>().toEqualTypeOf<GameMode>();
  });

  it('store only runs that are over', () => {
    expectTypeOf<Enums['run_status']>().toEqualTypeOf<Extract<GameStatus, 'won' | 'lost'>>();
  });

  it('give a run the columns the server fills from a replay and its result', () => {
    expectTypeOf<Run>().toHaveProperty('seed').toEqualTypeOf<number>();
    expectTypeOf<Run>().toHaveProperty('state_hash').toEqualTypeOf<string>();
    expectTypeOf<Run>().toHaveProperty('daily_date').toEqualTypeOf<string | null>();
  });

  it('merge the achievements of a device into the account, and read back its rows (#221)', () => {
    type Merge = Database['public']['Functions']['merge_achievements'];
    type Achievement = Database['public']['Tables']['achievements']['Row'];

    expectTypeOf<Merge['Returns']>().toEqualTypeOf<Achievement[]>();
    expectTypeOf<Achievement>().toHaveProperty('unlocked_at').toEqualTypeOf<string>();
  });
});
