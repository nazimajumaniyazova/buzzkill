// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { DIFFICULTIES, DIFFICULTY_IDS } from '../config/difficulty';
import { type LevelConfig, LEVELS } from '../config/levels';
import { POWER_UP_RULES, POWER_UPS, RAPID_FIRE, SHIELD } from '../config/power-ups';
import { Kind } from '../world/world';
import { createSimulation, type Simulation } from './simulation';
import type { BossState } from './state';

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

/** Puts a shot inside the queen's box, as if one had reached her; skipped when she is away. */
function strike(sim: Simulation): void {
  const { world, boss, tick } = sim.state;
  if (boss.id === undefined) {
    return;
  }
  const id = world.spawn(Kind.projectile, tick);
  if (id === undefined) {
    return;
  }
  world.place(id, (world.x[boss.id] as number) + 10, (world.y[boss.id] as number) + 120, 10, 3);
}

/** A campaign of a short level that the queen ends, then a short level without her. */
const queenCampaign = (health: number): readonly LevelConfig[] => [
  {
    breakTicks: 30,
    speedScale: 1,
    timeChangesAfter: false,
    waves: [{ count: 2, intervalTicks: 30 }],
    boss: { health },
  },
  {
    breakTicks: 30,
    speedScale: 1,
    timeChangesAfter: false,
    waves: [{ count: 2, intervalTicks: 30 }],
  },
];

/** Every phase the queen's state may hold after a tick that began in a phase (#152). */
const NEXT: Readonly<Record<BossState['phase'], readonly BossState['phase'][]>> = {
  absent: ['absent', 'entering'],
  entering: ['entering', 'attacking', 'defeated'],
  attacking: ['attacking', 'enraged', 'defeated'],
  enraged: ['enraged', 'windup', 'defeated'],
  windup: ['windup', 'charging', 'defeated'],
  charging: ['charging', 'returning', 'defeated'],
  returning: ['returning', 'enraged', 'defeated'],
  defeated: ['defeated', 'beaten'],
  beaten: ['beaten', 'absent'],
};

describe('boss fight invariants', () => {
  const fight = fc.record({
    seed: fc.nat({ max: 0xff_ff_ff_ff }),
    heroId: fc.constantFrom('male' as const, 'female' as const),
    mode: fc.constantFrom('day' as const, 'night' as const),
    difficulty: fc.constantFrom(...DIFFICULTY_IDS),
    // A small health, so that random play often enrages and defeats her.
    health: fc.integer({ min: 1, max: 15 }),
    // Long enough for her arrival, her rage and a charge.
    holds: fc.array(fc.tuple(fc.nat({ max: 7 }), fc.integer({ min: 1, max: 120 })), {
      minLength: 30,
      maxLength: 60,
    }),
    capacity: fc.integer({ min: 4, max: 64 }),
    // Bursts of shots put into her, one a tick, from this many ticks after she arrives, taking
    // this share of her health: random play alone seldom hits her, and so seldom enrages or
    // defeats her. Two bursts let one enrage her and the next defeat her after a charge.
    bursts: fc.array(
      fc.record({
        after: fc.integer({ min: 150, max: 1500 }),
        share: fc.double({ min: 0, max: 1.2, noNaN: true }),
      }),
      { maxLength: 2 },
    ),
    // A hero who holds a shield all run lives long enough to meet her charge.
    shielded: fc.boolean(),
  });

  test.prop([fight], { numRuns: 100 })(
    'her health only falls, she is in the world exactly while she fights, her phases follow her fight, and her level waits for her',
    ({ seed, heroId, mode, difficulty, health, holds, capacity, bursts, shielded }) => {
      const levels = queenCampaign(health);
      const simulation = createSimulation({ seed, heroId, mode, difficulty, capacity, levels });
      const { state } = simulation;
      if (shielded) {
        state.shieldTicks = Number.MAX_SAFE_INTEGER;
      }
      const { world, boss } = state;
      let maxHealth = 0;
      let arrived = Number.POSITIVE_INFINITY;
      state.events.on('bossEntered', (entered) => {
        maxHealth = entered.maxHealth;
        arrived = state.tick;
      });
      let previous = { phase: boss.phase, health: 0, down: 0 };
      // The checks of a tick are plain conditions: an `expect` per check and tick would make the
      // long runs of this property too slow. The first broken one is kept with its tick.
      let broken: string | undefined;
      const check = (ok: boolean, what: string): void => {
        if (!ok && broken === undefined) {
          broken = `tick ${String(state.tick)}: ${what}`;
        }
      };

      for (const [down, ticks] of holds) {
        for (let i = 0; i < ticks && broken === undefined; i += 1) {
          const next = state.tick + 1;
          for (const { after, share } of bursts) {
            const from = arrived + after;
            if (next >= from && next < from + Math.round(share * maxHealth)) {
              strike(simulation);
            }
          }
          simulation.step({ down, pressed: down & ~previous.down });

          check(NEXT[previous.phase].includes(boss.phase), `${previous.phase} to ${boss.phase}`);
          const fighting = boss.phase !== 'absent' && boss.phase !== 'beaten';
          let bosses = 0;
          for (let index = 0; index < world.count; index += 1) {
            const id = world.at(index);
            if (world.kind[id] === Kind.boss) {
              bosses += 1;
              check(id === boss.id, 'a boss entity that is not hers');
            }
          }
          check(bosses === (fighting ? 1 : 0), `${String(bosses)} bosses while ${boss.phase}`);
          check((boss.id !== undefined) === fighting, `her entity while ${boss.phase}`);

          const left = boss.id === undefined ? 0 : (world.health[boss.id] as number);
          if (boss.id !== undefined) {
            check(left >= 0 && left <= maxHealth, `health ${String(left)} of ${String(maxHealth)}`);
            check(
              previous.phase === 'absent' || left <= previous.health,
              `health rose from ${String(previous.health)} to ${String(left)}`,
            );
            check(world.value[boss.id] === maxHealth, 'her most health changed');
          }
          if (state.level === 1 && (state.status === 'levelCleared' || state.status === 'won')) {
            check(boss.phase === 'beaten', `level 1 over while she is ${boss.phase}`);
          }
          previous = { phase: boss.phase, health: left, down };
        }
      }

      expect(broken).toBeUndefined();
    },
  );
});
