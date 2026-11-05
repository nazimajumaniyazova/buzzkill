// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { RULES } from '../config/rules';
import { createSimulation } from './simulation';

/**
 * Properties of whole runs, checked after every tick of random play. The rule functions have
 * their own properties in `rules.test.ts`; these catch a system that applies a rule wrongly, or
 * twice, or in the wrong state.
 */
describe('simulation invariants', () => {
  const run = fc.record({
    seed: fc.nat({ max: 0xff_ff_ff_ff }),
    heroId: fc.constantFrom('male' as const, 'female' as const),
    mode: fc.constantFrom('day' as const, 'night' as const),
    // Held masks of moveUp, moveDown and fire, each held for a while: closer to real play than
    // a new random mask every tick, and long enough to reach the end of a run.
    holds: fc.array(fc.tuple(fc.nat({ max: 7 }), fc.integer({ min: 1, max: 120 })), {
      minLength: 1,
      maxLength: 60,
    }),
    capacity: fc.integer({ min: 2, max: 64 }),
  });

  test.prop([run], { numRuns: 60 })(
    'score never decreases, lives and ammo stay in bounds, and the end is final',
    ({ seed, heroId, mode, holds, capacity }) => {
      const simulation = createSimulation({ seed, heroId, mode, capacity });
      const { state } = simulation;
      let previous = {
        tick: 0,
        score: 0,
        lives: RULES.lives as number,
        status: state.status,
        down: 0,
      };

      for (const [down, ticks] of holds) {
        for (let i = 0; i < ticks; i += 1) {
          simulation.step({ down, pressed: down & ~previous.down });

          expect(state.tick).toBe(previous.tick + 1);
          expect(state.score).toBeGreaterThanOrEqual(previous.score);
          expect(state.lives).toBeGreaterThanOrEqual(0);
          expect(state.lives).toBeLessThanOrEqual(previous.lives);
          expect(state.ammo).toBeGreaterThanOrEqual(0);
          expect(state.ammo).toBeLessThanOrEqual(RULES.ammo.max);
          expect(state.world.count).toBeLessThanOrEqual(capacity);
          if (previous.status !== 'playing') {
            expect(state.status).toBe(previous.status);
            expect(state.score).toBe(previous.score);
            expect(state.lives).toBe(previous.lives);
          }
          if (state.lives === 0) {
            expect(state.status).toBe('lost');
          }
          previous = {
            tick: state.tick,
            score: state.score,
            lives: state.lives,
            status: state.status,
            down,
          };
        }
      }
    },
  );
});
