import { createFnv1a } from '@buzzkill/engine';

import type { Difficulty } from '../config/difficulty';
import type { GameMode } from '../config/enemies';
import type { BossPhase } from '../simulation/boss';
import type { GameStatus } from '../simulation/rules';
import type { BossState, GameState } from '../simulation/state';

/** The outcome of a run, as the leaderboard stores and verifies it (ADR-0009). */
export interface RunResult {
  readonly score: number;
  /** The level reached, from 1; the last one when the run is won (ADR-0017). */
  readonly level: number;
  /** Simulation ticks run. */
  readonly ticks: number;
  readonly livesLeft: number;
  readonly status: GameStatus;
  /** FNV-1a of the whole state, as 8 hex digits. Equal hashes mean equal runs. */
  readonly hash: string;
}

const STATUS_CODE = { playing: 0, won: 1, lost: 2, levelCleared: 3 } as const satisfies Record<
  GameStatus,
  number
>;
const MODE_CODE = { day: 0, night: 1 } as const satisfies Record<GameMode, number>;
const DIFFICULTY_CODE = { easy: 0, normal: 1, hard: 2 } as const satisfies Record<
  Difficulty,
  number
>;
const BOSS_PHASE_CODE = {
  entering: 0,
  attacking: 1,
  enraged: 2,
  windup: 3,
  charging: 4,
  returning: 5,
  defeated: 6,
  beaten: 7,
} as const satisfies Record<Exclude<BossState['phase'], 'absent'>, number> &
  Record<BossPhase, number>;
/** Stands for the boss's entity once she has left the world. */
const NO_ENTITY = 0xff_ff_ff_ff;

/**
 * Hashes a canonical serialization of the state: the run's counters, the RNG state and every live
 * entity in iteration order with all of its components, floats by their raw bits. Anything that
 * can change the rest of a run is included, so two states with one hash continue alike.
 *
 * The boss's counters come last, and only once she has arrived in the level (#152): while she is
 * absent they are always at rest, so they would add nothing, and the runs pinned before her keep
 * their hashes.
 */
export function hashGameState(state: GameState): string {
  const hasher = createFnv1a();
  hasher
    .uint32(state.tick)
    .uint32(STATUS_CODE[state.status])
    .uint32(state.score)
    .uint32(state.lives)
    .uint32(state.ammo)
    .uint32(DIFFICULTY_CODE[state.difficulty])
    .uint32(MODE_CODE[state.mode])
    .uint32(state.level)
    .uint32(state.wave)
    .uint32(state.waveSent)
    .uint32(state.spawnTimer)
    .uint32(state.shieldTicks)
    .uint32(state.rapidFireTicks)
    .uint32(state.fireCooldown);
  for (const word of state.rng.getState()) {
    hasher.uint32(word);
  }

  const { world } = state;
  hasher.uint32(world.count);
  for (let index = 0; index < world.count; index += 1) {
    const id = world.at(index);
    // Typed-array reads below are in bounds: `id` is a live entity of this world.
    hasher
      .uint32(id)
      .uint32(world.kind[id] as number)
      .float64(world.x[id] as number)
      .float64(world.y[id] as number)
      .float64(world.width[id] as number)
      .float64(world.height[id] as number)
      .float64(world.prevX[id] as number)
      .float64(world.prevY[id] as number)
      .float64(world.vx[id] as number)
      .float64(world.vy[id] as number)
      .uint32(world.health[id] as number)
      .uint32(world.value[id] as number)
      .float64(world.angle[id] as number)
      .float64(world.angleSpeed[id] as number)
      .float64(world.amplitude[id] as number)
      .uint32(world.variant[id] as number)
      .uint32(world.bornTick[id] as number);
  }

  const { boss } = state;
  if (boss.phase !== 'absent') {
    hasher
      .uint32(BOSS_PHASE_CODE[boss.phase])
      .uint32(boss.id ?? NO_ENTITY)
      .uint32(boss.phaseTicks)
      .float64(boss.targetY)
      .uint32(boss.struck ? 1 : 0);
  }
  return hasher.hex();
}

/** The result of the run in `state` at its current tick. */
export function runResultOf(state: GameState): RunResult {
  return {
    score: state.score,
    level: state.level,
    ticks: state.tick,
    livesLeft: state.lives,
    status: state.status,
    hash: hashGameState(state),
  };
}
