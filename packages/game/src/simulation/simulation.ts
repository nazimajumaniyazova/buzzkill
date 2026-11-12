import { createEventBus, createRng } from '@buzzkill/engine';

import { DIFFICULTIES, type Difficulty } from '../config/difficulty';
import { ENEMY_SETS, type GameMode } from '../config/enemies';
import { LEVELS } from '../config/levels';
import { HEROES, type HeroId, RULES } from '../config/rules';
import { createWorld, Kind } from '../world/world';
import { paced } from './rules';
import type { GameEvents, GameState, TickInput } from './state';
import { startNextLevel, SYSTEMS } from './systems';

export interface SimulationOptions {
  /** 32-bit seed; the same seed and inputs always give the same run (ADR-0009). */
  readonly seed: number;
  readonly heroId: HeroId;
  /** The time of day of the first level; a later level may change it (ADR-0017). */
  readonly mode: GameMode;
  /** Normal when left out: the numbers of the 2023 game (#155). */
  readonly difficulty?: Difficulty;
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
  const difficulty = options.difficulty ?? 'normal';
  const preset = DIFFICULTIES[difficulty];
  const state: GameState = {
    world,
    rng: createRng(options.seed),
    events: createEventBus<GameEvents>(),
    heroId: options.heroId,
    hero,
    difficulty,
    mode: options.mode,
    enemies,
    enemyWeights: enemies.map((enemy) => enemy.weight),
    player,
    tick: 0,
    status: 'playing',
    score: 0,
    lives: preset.lives,
    ammo: preset.ammo.start,
    level: 1,
    wave: 0,
    waveSent: 0,
    spawnTimer: paced(LEVELS[0].breakTicks, preset.pace),
  };

  return {
    state,
    step(input) {
      state.tick += 1;
      if (state.status === 'levelCleared') {
        startNextLevel(state);
      }
      for (const system of SYSTEMS) {
        system(state, input);
      }
      world.flushDead();
    },
  };
}
