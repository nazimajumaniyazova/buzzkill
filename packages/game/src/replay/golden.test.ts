import { describe, expect, it } from 'vitest';

import dayMale from '../../fixtures/replays/day-male-2026.json' with { type: 'json' };
import nightFemale from '../../fixtures/replays/night-female-2026.json' with { type: 'json' };
import { parseReplay } from './format';
import { simulate } from './simulate';

/**
 * Golden replays (ADR-0009): scripted runs whose result is pinned here. Any change to the rules,
 * the enemy data, the RNG or the iteration order changes a hash. When such a change is intended,
 * the PR says so and updates the values below with `vitest -u`.
 *
 * The script: sweep down and up over 4 s and fire for 2 ticks out of every 15, until the run ends
 * or after 5 minutes.
 */
describe('golden replays', () => {
  it.each([
    ['day, male hero', dayMale],
    ['night, female hero', nightFemale],
  ])('%s gives the pinned result', (_name, fixture) => {
    const parsed = parseReplay(fixture);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    expect(simulate(parsed.replay, { maxTicks: 60 * 60 * 5 })).toMatchSnapshot();
  });
});
