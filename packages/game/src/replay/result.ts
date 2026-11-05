import { createFnv1a } from '@buzzkill/engine';

import type { GameStatus } from '../simulation/rules';
import type { GameState } from '../simulation/state';

/** The outcome of a run, as the leaderboard stores and verifies it (ADR-0009). */
export interface RunResult {
  readonly score: number;
  /** Always 1 until levels arrive in stage 7; part of the format so the server schema is stable. */
  readonly level: number;
  /** Simulation ticks run. */
  readonly ticks: number;
  readonly livesLeft: number;
  readonly status: GameStatus;
  /** FNV-1a of the whole state, as 8 hex digits. Equal hashes mean equal runs. */
  readonly hash: string;
}

const STATUS_CODE = { playing: 0, won: 1, lost: 2 } as const satisfies Record<GameStatus, number>;

/**
 * Hashes a canonical serialization of the state: the run's counters, the RNG state and every live
 * entity in iteration order with all of its components, floats by their raw bits. Anything that
 * can change the rest of a run is included, so two states with one hash continue alike.
 */
export function hashGameState(state: GameState): string {
  const hasher = createFnv1a();
  hasher
    .uint32(state.tick)
    .uint32(STATUS_CODE[state.status])
    .uint32(state.score)
    .uint32(state.lives)
    .uint32(state.ammo)
    .uint32(state.spawnTimer)
    .uint32(state.spawnInterval);
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
  return hasher.hex();
}

/** The result of the run in `state` at its current tick. */
export function runResultOf(state: GameState): RunResult {
  return {
    score: state.score,
    level: 1,
    ticks: state.tick,
    livesLeft: state.lives,
    status: state.status,
    hash: hashGameState(state),
  };
}
