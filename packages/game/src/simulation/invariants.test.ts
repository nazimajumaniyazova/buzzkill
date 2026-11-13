// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { DIFFICULTIES, DIFFICULTY_IDS } from '../config/difficulty';
import { LEVELS } from '../config/levels';
import { POWER_UP_RULES, POWER_UPS, RAPID_FIRE, SHIELD } from '../config/power-ups';
import { Kind } from '../world/world';
import { createSimulation, type Simulation } from './simulation';

/** Puts a power-up on the hero, as if one had dropped there; skipped when the world is full. */
function gift(sim: Simulation, variant: number): void {
  const { world, player, tick } = sim.state;
  const id = world.spawn(Kind.powerUp, tick);
  if (id === undefined) {
    return;
  }
  const size = POWER_UP_RULES.size;
  world.place(id, world.x[player] as number, world.y[player] as number, size, size);
  world.variant[id] = variant;
}

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
    difficulty: fc.constantFrom(...DIFFICULTY_IDS),
    // Held masks of moveUp, moveDown and fire, each held for a while: closer to real play than
    // a new random mask every tick, and long enough to reach the end of a run.
    holds: fc.array(fc.tuple(fc.nat({ max: 7 }), fc.integer({ min: 1, max: 120 })), {
      minLength: 1,
      maxLength: 60,
    }),
    capacity: fc.integer({ min: 2, max: 64 }),
    // Power-ups put on the hero before these ticks: random play alone collects too few of them
    // to test what they do (#151).
    gifts: fc.array(
      fc.tuple(fc.integer({ min: 1, max: 3000 }), fc.nat({ max: POWER_UPS.length - 1 })),
      { maxLength: 40 },
    ),
  });

  test.prop([run], { numRuns: 60 })(
    'score never decreases, lives and ammo stay in bounds, a shield blocks every hit, levels go one by one, and the end is final',
    ({ seed, heroId, mode, difficulty, holds, capacity, gifts }) => {
      const simulation = createSimulation({ seed, heroId, mode, difficulty, capacity });
      const { state } = simulation;
      const preset = DIFFICULTIES[difficulty];
      let livesCollected = 0;
      state.events.on('powerUpCollected', ({ kind }) => {
        livesCollected += kind === 'life' ? 1 : 0;
      });
      let previous = {
        tick: 0,
        score: 0,
        lives: state.lives,
        shieldTicks: 0,
        status: state.status,
        level: 1,
        down: 0,
      };

      for (const [down, ticks] of holds) {
        for (let i = 0; i < ticks; i += 1) {
          for (const [tick, variant] of gifts) {
            if (tick === state.tick + 1) {
              gift(simulation, variant);
            }
          }
          livesCollected = 0;
          simulation.step({ down, pressed: down & ~previous.down });

          expect(state.tick).toBe(previous.tick + 1);
          expect(state.score).toBeGreaterThanOrEqual(previous.score);
          expect(state.lives).toBeGreaterThanOrEqual(0);
          expect(state.lives).toBeLessThanOrEqual(preset.lives);
          // Lives come back only from a life collected in that tick.
          expect(state.lives).toBeLessThanOrEqual(previous.lives + livesCollected);
          if (previous.shieldTicks > 0) {
            expect(state.lives).toBeGreaterThanOrEqual(previous.lives);
          }
          expect(state.ammo).toBeGreaterThanOrEqual(0);
          expect(state.ammo).toBeLessThanOrEqual(preset.ammo.max);
          expect(state.shieldTicks).toBeLessThanOrEqual(SHIELD.durationTicks);
          expect(state.rapidFireTicks).toBeLessThanOrEqual(RAPID_FIRE.durationTicks);
          expect(state.world.count).toBeLessThanOrEqual(capacity);
          expect(state.level).toBeLessThanOrEqual(LEVELS.length);
          // Levels go one by one: the next starts on the tick after a level is cleared.
          expect(state.level).toBe(
            previous.status === 'levelCleared' ? previous.level + 1 : previous.level,
          );
          if (previous.status === 'won' || previous.status === 'lost') {
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
            shieldTicks: state.shieldTicks,
            status: state.status,
            level: state.level,
            down,
          };
        }
      }
    },
  );
});
