/**
 * The systems of the simulation, each a function of the state for one tick. `SYSTEMS` is the
 * update order (ADR-0003: the system list is the order), and the order is part of the
 * determinism contract (ADR-0009): changing it changes every replay.
 */
import { boxesOverlap } from '@buzzkill/engine';

import { ENEMY_SETS } from '../config/enemies';
import { type LevelConfig, LEVELS, type WaveConfig } from '../config/levels';
import { RULES, WORLD } from '../config/rules';
import { type EntityId, Kind } from '../world/world';
import {
  ammoAfterTick,
  healthAfterHit,
  intInRange,
  livesAfterHit,
  pickWeighted,
  scoreAfterKill,
  statusFor,
  timeAfterLevel,
  valueInRange,
  waveStep,
} from './rules';
import type { GameState, TickInput } from './state';

// Bits of GAME_ACTIONS: moveUp, moveDown, fire, pause.
const MOVE_UP = 1;
const MOVE_DOWN = 2;
const FIRE = 4;

/** The campaign, typed as levels so that a wave's optional weights can be read. */
const CAMPAIGN: readonly LevelConfig[] = LEVELS;

/** Hero speed from the held move actions; up wins when both are held, as in 2023. */
function controlSystem(state: GameState, input: TickInput): void {
  const { world, player } = state;
  if (state.status !== 'playing') {
    world.vy[player] = 0;
    return;
  }
  const speed = RULES.player.speed;
  world.vy[player] =
    (input.down & MOVE_UP) !== 0 ? -speed : (input.down & MOVE_DOWN) !== 0 ? speed : 0;
}

/**
 * One projectile per press of fire while rounds remain. The 2023 game fired on every keydown,
 * key auto-repeat included, and charged a round only for shots that missed; a shot now costs a
 * round when it is fired.
 */
function shootingSystem(state: GameState, input: TickInput): void {
  if (state.status !== 'playing' || (input.pressed & FIRE) === 0 || state.ammo <= 0) {
    return;
  }
  const { world, player, hero } = state;
  const id = world.spawn(Kind.projectile, state.tick);
  if (id === undefined) {
    return;
  }
  const { width, height, speed } = RULES.projectile;
  // The hero is always alive, so its position is always set.
  const x = (world.x[player] as number) + hero.muzzle.x;
  const y = (world.y[player] as number) + hero.muzzle.y;
  world.place(id, x, y, width, height);
  world.vx[id] = speed;
  state.ammo -= 1;
  state.events.emit('shot', { x, y });
}

/** Moves every entity by its velocity; enemies also follow their wave, the hero stays on screen. */
function movementSystem(state: GameState): void {
  const { world } = state;
  const { x, y, prevX, prevY, vx, vy, kind, height } = world;
  for (let index = 0; index < world.count; index += 1) {
    const id = world.at(index);
    // Typed arrays are sized to the capacity and `id` is a live id, so every read is in bounds.
    const px = x[id] as number;
    const py = y[id] as number;
    prevX[id] = px;
    prevY[id] = py;
    x[id] = px + (vx[id] as number);
    let ny = py + (vy[id] as number);
    if (kind[id] === Kind.enemy) {
      const angle = world.angle[id] as number;
      ny += waveStep(world.amplitude[id] as number, angle);
      world.angle[id] = angle + (world.angleSpeed[id] as number);
    } else if (kind[id] === Kind.player) {
      const h = height[id] as number;
      const top = -h * RULES.player.overhangTop;
      const bottom = WORLD.height - h * (1 - RULES.player.overhangBottom);
      ny = ny < top ? top : ny > bottom ? bottom : ny;
    }
    y[id] = ny;
  }
}

/** Removes projectiles past their range, enemies past the left edge and finished explosions. */
function lifetimeSystem(state: GameState): void {
  const { world, tick } = state;
  const range = WORLD.width * RULES.projectile.rangeRatio;
  const explosionTicks = RULES.explosion.frames * RULES.explosion.frameTicks;
  for (let index = 0; index < world.count; index += 1) {
    const id = world.at(index);
    const kind = world.kind[id];
    const x = world.x[id] as number;
    if (
      (kind === Kind.projectile && x > range) ||
      (kind === Kind.enemy && x + (world.width[id] as number) < 0) ||
      (kind === Kind.explosion && tick - (world.bornTick[id] as number) >= explosionTicks)
    ) {
      world.kill(id);
    }
  }
}

function spawnExplosion(state: GameState, enemy: EntityId): void {
  const { world } = state;
  const centerX = (world.x[enemy] as number) + (world.width[enemy] as number) * 0.5;
  const centerY = (world.y[enemy] as number) + (world.height[enemy] as number) * 0.5;
  // Drawn smoke or fire with equal chance, as in 2023. The roll is taken even when the world is
  // full, so a full world does not shift every later random number.
  const variant = state.rng.chance(0.5) ? 0 : 1;
  const id = world.spawn(Kind.explosion, state.tick);
  state.events.emit('explosion', { x: centerX, y: centerY, variant });
  if (id === undefined) {
    return;
  }
  const size = RULES.explosion.size;
  world.place(id, centerX - size * 0.5, centerY - size * 0.5, size, size);
  world.vx[id] = -RULES.scrollSpeed;
  world.variant[id] = variant;
}

const overlaps = (state: GameState, a: EntityId, b: EntityId): boolean => {
  const { x, y, width, height } = state.world;
  return boxesOverlap(
    x[a] as number,
    y[a] as number,
    width[a] as number,
    height[a] as number,
    x[b] as number,
    y[b] as number,
    width[b] as number,
    height[b] as number,
  );
};

/**
 * Enemy against hero, then enemy against every projectile, enemies in world order. With tens of
 * entities the plain double loop is faster than the spatial hash (see the #37 benchmark); the
 * hash takes over if stage 7 brings hundreds.
 *
 * A projectile is used up by its first hit, and an enemy already destroyed this tick is not hit
 * again; in 2023 one projectile could damage several enemies in the same frame.
 */
function collisionSystem(state: GameState): void {
  if (state.status !== 'playing') {
    return;
  }
  const { world, player } = state;
  for (let i = 0; i < world.count; i += 1) {
    const enemy = world.at(i);
    if (world.kind[enemy] !== Kind.enemy || !world.isAlive(enemy)) {
      continue;
    }
    if (overlaps(state, player, enemy)) {
      world.kill(enemy);
      spawnExplosion(state, enemy);
      state.lives = livesAfterHit(state.lives);
      state.events.emit('playerHit', { livesLeft: state.lives });
      continue;
    }
    for (let j = 0; j < world.count; j += 1) {
      const projectile = world.at(j);
      if (world.kind[projectile] !== Kind.projectile || !world.isAlive(projectile)) {
        continue;
      }
      if (!overlaps(state, projectile, enemy)) {
        continue;
      }
      world.kill(projectile);
      const health = healthAfterHit(world.health[enemy] as number);
      world.health[enemy] = health;
      if (health > 0) {
        state.events.emit('enemyHit', { id: enemy, healthLeft: health });
        continue;
      }
      world.kill(enemy);
      spawnExplosion(state, enemy);
      const value = world.value[enemy] as number;
      state.score = scoreAfterKill(state.score, value);
      state.events.emit('enemyDestroyed', {
        x: world.x[enemy] as number,
        y: world.y[enemy] as number,
        value,
      });
      break;
    }
  }
}

function anyEnemyAlive(state: GameState): boolean {
  const { world } = state;
  for (let index = 0; index < world.count; index += 1) {
    const id = world.at(index);
    if (world.kind[id] === Kind.enemy && world.isAlive(id)) {
      return true;
    }
  }
  return false;
}

/**
 * Ends the run when the hero is out of lives, and the level once all its waves are sent and no
 * enemy is left: the last level wins the run, any other is cleared for the next (ADR-0017).
 */
function outcomeSystem(state: GameState): void {
  if (state.status !== 'playing') {
    return;
  }
  const level = CAMPAIGN[state.level - 1];
  const levelDone =
    level !== undefined && state.wave >= level.waves.length && !anyEnemyAlive(state);
  const status = statusFor(state.lives, levelDone, state.level >= CAMPAIGN.length);
  if (status === 'playing') {
    return;
  }
  state.status = status;
  if (status === 'levelCleared') {
    state.events.emit('levelCleared', { level: state.level, score: state.score });
  } else {
    state.events.emit('gameOver', { result: status, score: state.score });
  }
}

/** Gives back a round of ammo at a fixed rate. */
function ammoSystem(state: GameState): void {
  if (state.status === 'playing') {
    state.ammo = ammoAfterTick(state.ammo, state.tick);
  }
}

/**
 * Sends the enemies of the level's current wave at the wave's pace, after the level's calm before
 * each wave. Once the last wave is sent, nothing more comes until the next level.
 */
function spawnSystem(state: GameState): void {
  if (state.status !== 'playing') {
    return;
  }
  const level = CAMPAIGN[state.level - 1];
  const wave = level?.waves[state.wave];
  if (level === undefined || wave === undefined) {
    return;
  }
  state.spawnTimer -= 1;
  if (state.spawnTimer > 0) {
    return;
  }
  spawnEnemy(state, wave, level.speedScale);
  state.waveSent += 1;
  if (state.waveSent < wave.count) {
    state.spawnTimer = wave.intervalTicks;
    return;
  }
  state.wave += 1;
  state.waveSent = 0;
  state.spawnTimer = level.breakTicks;
}

/** Spawns one enemy of the time's set at the right edge, with the rolls of the 2023 game. */
function spawnEnemy(state: GameState, wave: WaveConfig, speedScale: number): void {
  const { rng, enemies, enemyWeights, world } = state;
  // Every roll is taken in a fixed order before the spawn can fail, so the sequence of random
  // numbers never depends on whether the world had room (ADR-0009).
  const variant = pickWeighted(wave.weights ?? enemyWeights, rng.nextFloat());
  const config = enemies[variant];
  const yRoll = rng.nextFloat();
  const speedRoll = rng.nextFloat();
  const livesRoll = rng.nextFloat();
  const amplitudeRoll = rng.nextFloat();
  const angleSpeedRoll = rng.nextFloat();
  if (config === undefined) {
    return;
  }
  const id = world.spawn(Kind.enemy, state.tick);
  if (id === undefined) {
    return;
  }
  const { width, height } = config.hitbox;
  const lives = intInRange(config.lives, livesRoll);
  world.place(
    id,
    WORLD.width,
    yRoll * (WORLD.height - height * RULES.spawn.bottomMarginRatio),
    width,
    height,
  );
  world.vx[id] = -valueInRange(config.speed, speedRoll) * speedScale;
  world.health[id] = lives;
  world.value[id] = lives;
  world.amplitude[id] = valueInRange(config.wave.amplitude, amplitudeRoll);
  world.angleSpeed[id] = valueInRange(config.wave.angleSpeed, angleSpeedRoll);
  world.variant[id] = variant;
}

/**
 * Moves a cleared run on to the next level: its waves from the start, after its calm, at the
 * other time of day when the cleared level says so (ADR-0017). Not a system: the simulation calls
 * it at the start of the tick after a level is cleared.
 */
export function startNextLevel(state: GameState): void {
  const next = CAMPAIGN[state.level];
  if (next === undefined) {
    // Unreachable: clearing the last level wins the run instead.
    return;
  }
  const mode = timeAfterLevel(state.level, state.mode);
  if (mode !== state.mode) {
    state.mode = mode;
    state.enemies = ENEMY_SETS[mode];
    state.enemyWeights = state.enemies.map((enemy) => enemy.weight);
  }
  state.level += 1;
  state.wave = 0;
  state.waveSent = 0;
  state.spawnTimer = next.breakTicks;
  state.status = 'playing';
  state.events.emit('levelStarted', { level: state.level, mode: state.mode });
}

/** The update order of one tick. */
export const SYSTEMS = [
  controlSystem,
  shootingSystem,
  movementSystem,
  lifetimeSystem,
  collisionSystem,
  outcomeSystem,
  ammoSystem,
  spawnSystem,
] as const satisfies readonly ((state: GameState, input: TickInput) => void)[];
