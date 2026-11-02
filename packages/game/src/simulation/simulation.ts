import { createEventBus, createRng } from '@buzzkill/engine';

import { ENEMY_SETS, type GameMode } from '../config/enemies';
import { HEROES, type HeroId, RULES } from '../config/rules';
import { createWorld, Kind } from '../world/world';
import type { GameEvents, GameState, TickInput } from './state';
import { SYSTEMS } from './systems';

export interface SimulationOptions {
  /** 32-bit seed; the same seed and inputs always give the same run (ADR-0009). */
  readonly seed: number;
  readonly heroId: HeroId;
  readonly mode: GameMode;
  /** Most entities alive at once. Spawns beyond it are skipped. Default 256. */
  readonly capacity?: number;
}

export interface Simulation {
  /** The live state. Read it to render; only `step` changes it. */
  readonly state: GameState;
  /** Advances the run by exactly one tick with the given input. */
  step(input: TickInput): void;
}

/**
 * Creates a headless run of the game: no DOM, no clock, no `Math.random`. Everything that varies
 * comes from the seed and from the inputs passed to `step`, so a run can be replayed in Node or
 * in an edge function and give the same state bit for bit.
 */
export function createSimulation(options: SimulationOptions): Simulation {
  const world = createWorld(options.capacity ?? 256);
  const hero = HEROES[options.heroId];
  const player = world.spawn(Kind.player, 0);
  if (player === undefined) {
    // Unreachable: `createWorld` rejects a capacity below 1, so the first spawn always succeeds.
    throw new Error('createSimulation: the world has no room for the hero');
  }
  world.place(player, RULES.player.start.x, RULES.player.start.y, hero.width, hero.height);

  const enemies = ENEMY_SETS[options.mode];
  const state: GameState = {
    world,
    rng: createRng(options.seed),
    events: createEventBus<GameEvents>(),
    heroId: options.heroId,
    hero,
    mode: options.mode,
    enemies,
    enemyWeights: enemies.map((enemy) => enemy.weight),
    player,
    tick: 0,
    status: 'playing',
    score: 0,
    lives: RULES.lives,
    ammo: RULES.ammo.start,
    spawnTimer: 0,
    spawnInterval: RULES.spawn.intervalTicks,
  };

  return {
    state,
    step(input) {
      state.tick += 1;
      for (const system of SYSTEMS) {
        system(state, input);
      }
      world.flushDead();
    },
  };
}
