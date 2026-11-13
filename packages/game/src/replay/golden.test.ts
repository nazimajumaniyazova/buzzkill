import { describe, expect, it } from 'vitest';

import campaignDayMale from '../../fixtures/replays/campaign-day-male-3.json' with { type: 'json' };
import campaignEasyMale from '../../fixtures/replays/campaign-easy-male-6.json' with { type: 'json' };
import dayMale from '../../fixtures/replays/day-male-2026.json' with { type: 'json' };
import nightFemale from '../../fixtures/replays/night-female-2026.json' with { type: 'json' };
import { parseReplay } from './format';
import { simulate } from './simulate';

/**
 * Golden replays (ADR-0009): scripted runs whose result is pinned here. Any change to the rules,
 * the enemy data, the RNG or the iteration order changes a hash. When such a change is intended,
 * the PR says so and updates the values below with `vitest -u`.
 *
 * The first two follow a script: sweep down and up over 4 s and fire for 2 ticks out of every 15,
 * until the run ends or after 5 minutes. They fall in the first levels.
 *
 * The campaign replays were played once by a bot that aims at the nearest enemy and steps aside
 * from one about to fly into the hero, and recorded; their inputs are fixed from then on. The bot
 * does not chase power-ups, it collects the ones that drift into it. Power-ups changed every
 * later random number (#151), so both were played again then:
 *
 * - seed 3 clears four levels, sees the sun set after the third (ADR-0017) and falls in the
 *   fifth; its shield blocks two enemies;
 * - seed 6 at easy wins the run, the one replay through all six levels, and collects every kind
 *   of power-up, a life among them.
 */
describe('golden replays', () => {
  it.each([
    ['day, male hero', dayMale],
    ['night, female hero', nightFemale],
    ['the campaign, day, male hero, seed 3', campaignDayMale],
    ['the easy campaign won, day, male hero, seed 6', campaignEasyMale],
  ])('%s gives the pinned result', (_name, fixture) => {
    const parsed = parseReplay(fixture);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    expect(simulate(parsed.replay, { maxTicks: 60 * 60 * 10 })).toMatchSnapshot();
  });

  // The same inputs at the other difficulties (#155): another run, as fixed as the first.
  it.each(['easy', 'hard'] as const)(
    'the campaign inputs at %s difficulty give the pinned result',
    (difficulty) => {
      const parsed = parseReplay(campaignDayMale);
      if (!parsed.ok) {
        throw new Error(parsed.error);
      }

      expect(
        simulate({ ...parsed.replay, difficulty }, { maxTicks: 60 * 60 * 10 }),
      ).toMatchSnapshot();
    },
  );
});
