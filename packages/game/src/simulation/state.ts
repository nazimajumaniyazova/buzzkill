import type { EventBus, Rng } from '@buzzkill/engine';

import type { Difficulty } from '../config/difficulty';
import type { EnemyConfig, GameMode } from '../config/enemies';
import type { PowerUpKind } from '../config/power-ups';
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
  /** An enemy flew into the hero and took a life; a shield takes the blow without this event. */
  playerHit: { readonly livesLeft: number };
  /** The hero collected a power-up centered on this point (#151). */
  powerUpCollected: { readonly kind: PowerUpKind; readonly x: number; readonly y: number };
  /** An explosion started, centered on this point. */
  explosion: { readonly x: number; readonly y: number; readonly variant: number };
  /** Every wave of `level` was sent and no enemy is left; the next level starts on the next tick. */
  levelCleared: { readonly level: number; readonly score: number };
  /** A level after the first one started, at this time of day (ADR-0017). */
  levelStarted: { readonly level: number; readonly mode: GameMode };
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
  /** The difficulty the run was started at; `DIFFICULTIES` gives its numbers (#155). */
  readonly difficulty: Difficulty;
  /** The time of day of the level being played; a level can change it for the next (ADR-0017). */
  mode: GameMode;
  /** The enemy set of `mode`. */
  enemies: readonly EnemyConfig[];
  /** `enemies[i].weight`, precomputed for the spawn roll of a wave without weights of its own. */
  enemyWeights: readonly number[];
  readonly player: EntityId;
  /** Ticks simulated so far. */
  tick: number;
  status: GameStatus;
  score: number;
  lives: number;
  ammo: number;
  /** The level being played, from 1 (`LEVELS[level - 1]`). */
  level: number;
  /** The wave of the level being sent, from 0; the number of waves once all are sent. */
  wave: number;
  /** Enemies the current wave has sent. */
  waveSent: number;
  /** Ticks until the next enemy of the wave, or until the wave starts after its calm. */
  spawnTimer: number;
  /** Ticks the shield still lasts; 0 when the hero has none (#151). */
  shieldTicks: number;
  /** Ticks rapid fire still lasts; 0 when it is off (#151). */
  rapidFireTicks: number;
  /** Ticks until held fire shoots again during rapid fire. */
  fireCooldown: number;
}

/** The actions of one tick as bit masks over `GAME_ACTIONS` (the engine's `InputSnapshot`). */
export interface TickInput {
  /** Actions down this tick. */
  readonly down: number;
  /** Actions that went down this tick. */
  readonly pressed: number;
}
