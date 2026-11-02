import type { EventBus, Rng } from '@buzzkill/engine';

import type { EnemyConfig, GameMode } from '../config/enemies';
import type { HeroConfig, HeroId } from '../config/rules';
import type { EntityId, World } from '../world/world';
import type { GameStatus } from './rules';

/** Everything the simulation reports to the edges: audio, renderer effects, HUD, the shell. */
export interface GameEvents {
  /** The hero fired a projectile from this point. */
  shot: { readonly x: number; readonly y: number };
  /** A projectile hit an enemy that survived. */
  enemyHit: { readonly id: EntityId; readonly healthLeft: number };
  /** An enemy was destroyed by a projectile and scored `value`. */
  enemyDestroyed: { readonly x: number; readonly y: number; readonly value: number };
  /** An enemy flew into the hero. */
  playerHit: { readonly livesLeft: number };
  /** An explosion started, centered on this point. */
  explosion: { readonly x: number; readonly y: number; readonly variant: number };
  /** The run ended. */
  gameOver: { readonly result: 'won' | 'lost'; readonly score: number };
}

/** The whole simulation state. Systems mutate it in place; nothing else does. */
export interface GameState {
  readonly world: World;
  /** The only source of randomness (ADR-0009). */
  readonly rng: Rng;
  readonly events: EventBus<GameEvents>;
  readonly heroId: HeroId;
  readonly hero: HeroConfig;
  readonly mode: GameMode;
  readonly enemies: readonly EnemyConfig[];
  /** `enemies[i].weight`, precomputed for the spawn roll. */
  readonly enemyWeights: readonly number[];
  readonly player: EntityId;
  /** Ticks simulated so far. */
  tick: number;
  status: GameStatus;
  score: number;
  lives: number;
  ammo: number;
  /** Ticks since the last enemy spawned. */
  spawnTimer: number;
  spawnInterval: number;
}

/** The actions of one tick as bit masks over `GAME_ACTIONS` (the engine's `InputSnapshot`). */
export interface TickInput {
  /** Actions down this tick. */
  readonly down: number;
  /** Actions that went down this tick. */
  readonly pressed: number;
}
