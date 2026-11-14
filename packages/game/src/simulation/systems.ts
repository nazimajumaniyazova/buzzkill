/**
 * The systems of the simulation, each a function of the state for one tick. `SYSTEMS` is the
 * update order (ADR-0003: the system list is the order), and the order is part of the
 * determinism contract (ADR-0009): changing it changes every replay.
 */
import { boxesOverlap } from '@buzzkill/engine';

import { type BossConfig, type BossPhaseConfig, QUEEN } from '../config/boss';
import { DIFFICULTIES, type Difficulty } from '../config/difficulty';
import { ENEMY_SETS } from '../config/enemies';
import type { WaveConfig } from '../config/levels';
import { POWER_UP_RULES, POWER_UPS, type PowerUpConfig, RAPID_FIRE } from '../config/power-ups';
import { RULES, WORLD } from '../config/rules';
import { type EntityId, Kind } from '../world/world';
import {
  aimedSlope,
  attackAt,
  type BossClock,
  bossHealthWith,
  type BossPhase,
  nextBossPhase,
} from './boss';
import {
  addCapped,
  ammoAfterTick,
  enemyLivesWith,
  healthAfterHit,
  intInRange,
  livesAfterHit,
  paced,
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

/** The power-ups, typed as configs so that one picked by its index can be narrowed by kind. */
const DROPS: readonly PowerUpConfig[] = POWER_UPS;
const DROP_WEIGHTS: readonly number[] = DROPS.map(({ weight }) => weight);

/** The boss of every level that names one (#152), typed as a config. */
const BOSS: BossConfig = QUEEN;

/** A brood: the boss's call for enemies of the time's set, at the set's own weights. */
const BROOD: WaveConfig = { count: BOSS.broodCount, intervalTicks: 1 };

/** Where explosions burst on the boss while she falls, as shares of her box, in turn. */
const DEBRIS = [
  [0.3, 0.35],
  [0.7, 0.3],
  [0.5, 0.65],
  [0.25, 0.75],
  [0.75, 0.6],
] as const;

/** Where the last explosions burst across her when her defeat has played out. */
const FINAL_BURSTS = [0.25, 0.5, 0.75] as const;

/** The places and times the boss's state machine compares against at a difficulty. */
function bossClockAt(difficulty: Difficulty): BossClock {
  const { pace } = DIFFICULTIES[difficulty];
  return {
    postX: BOSS.postX,
    rage: BOSS.rage,
    chargeAfterTicks: paced(BOSS.enraged.chargeAfterTicks, pace),
    windupTicks: paced(BOSS.charge.windupTicks, pace),
    defeatTicks: BOSS.defeat.ticks,
  };
}

/** Worked out once, so a tick of the fight allocates no clock. */
const BOSS_CLOCKS: Readonly<Record<Difficulty, BossClock>> = {
  easy: bossClockAt('easy'),
  normal: bossClockAt('normal'),
  hard: bossClockAt('hard'),
};

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
 *
 * During rapid fire (#151) fire shoots while it is held, once every `RAPID_FIRE.intervalTicks`
 * however often it is pressed, so a turbo button gains nothing; no shot costs a round.
 */
function shootingSystem(state: GameState, input: TickInput): void {
  if (state.status !== 'playing') {
    return;
  }
  if (state.rapidFireTicks > 0) {
    if (state.fireCooldown > 0) {
      state.fireCooldown -= 1;
    }
    if ((input.down & FIRE) !== 0 && state.fireCooldown === 0 && fireProjectile(state)) {
      state.fireCooldown = RAPID_FIRE.intervalTicks;
    }
    return;
  }
  if ((input.pressed & FIRE) !== 0 && state.ammo > 0 && fireProjectile(state)) {
    state.ammo -= 1;
  }
}

/** Fires a projectile from the hero's muzzle. False when the world has no room for it. */
function fireProjectile(state: GameState): boolean {
  const { world, player, hero } = state;
  const id = world.spawn(Kind.projectile, state.tick);
  if (id === undefined) {
    return false;
  }
  const { width, height, speed } = RULES.projectile;
  // The hero is always alive, so its position is always set.
  const x = (world.x[player] as number) + hero.muzzle.x;
  const y = (world.y[player] as number) + hero.muzzle.y;
  world.place(id, x, y, width, height);
  world.vx[id] = speed;
  state.events.emit('shot', { x, y });
  return true;
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

/**
 * Removes projectiles past their range, enemies, power-ups and stings past the left edge, stings
 * past the top or the bottom, and finished explosions. The boss is never removed here: her charge
 * takes her past the left edge, and she comes back.
 */
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
      ((kind === Kind.enemy || kind === Kind.powerUp) && x + (world.width[id] as number) < 0) ||
      (kind === Kind.sting && stingGone(state, id)) ||
      (kind === Kind.explosion && tick - (world.bornTick[id] as number) >= explosionTicks)
    ) {
      world.kill(id);
    }
  }
}

/** Whether a sting has left the world past the left edge, the top or the bottom. */
function stingGone(state: GameState, id: EntityId): boolean {
  const { world } = state;
  const y = world.y[id] as number;
  return (
    (world.x[id] as number) + (world.width[id] as number) < 0 ||
    y + (world.height[id] as number) < 0 ||
    y > WORLD.height
  );
}

/** An explosion centered on an entity. */
function spawnExplosion(state: GameState, entity: EntityId): void {
  const { world } = state;
  spawnExplosionAt(
    state,
    (world.x[entity] as number) + (world.width[entity] as number) * 0.5,
    (world.y[entity] as number) + (world.height[entity] as number) * 0.5,
  );
}

function spawnExplosionAt(state: GameState, centerX: number, centerY: number): void {
  const { world } = state;
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

/**
 * Rolls whether a destroyed enemy drops a power-up and which one (#151), and drops it centered
 * where the enemy was, no lower than the bottom of the world, so the hero can always reach it.
 */
function dropPowerUp(state: GameState, enemy: EntityId): void {
  const { world, rng } = state;
  // Both rolls are taken on every kill, before the spawn can fail, so the sequence of random
  // numbers depends neither on what dropped nor on whether the world had room (ADR-0009).
  const dropRoll = rng.nextFloat();
  const kindRoll = rng.nextFloat();
  if (dropRoll >= POWER_UP_RULES.dropChance) {
    return;
  }
  const id = world.spawn(Kind.powerUp, state.tick);
  if (id === undefined) {
    return;
  }
  const { size, speed } = POWER_UP_RULES;
  const x = (world.x[enemy] as number) + ((world.width[enemy] as number) - size) * 0.5;
  const y = (world.y[enemy] as number) + ((world.height[enemy] as number) - size) * 0.5;
  const lowest = WORLD.height - size;
  world.place(id, x, y < 0 ? 0 : y > lowest ? lowest : y, size, size);
  world.vx[id] = -speed;
  world.variant[id] = pickWeighted(DROP_WEIGHTS, kindRoll);
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
 * again; in 2023 one projectile could damage several enemies in the same frame. An enemy that
 * flies into a shielded hero explodes all the same, but takes no life, scores nothing and drops
 * nothing: only a shot earns those.
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
      hurtHero(state);
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
      dropPowerUp(state, enemy);
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

/** A blow to the hero: a life, unless a shield takes it. */
function hurtHero(state: GameState): void {
  if (state.shieldTicks > 0) {
    return;
  }
  state.lives = livesAfterHit(state.lives);
  state.events.emit('playerHit', { livesLeft: state.lives });
}

/**
 * The boss's fight against the hero (#152). Her stings strike the hero and break; her charge
 * strikes the hero once however long they overlap; the hero's shots hit her while she has health,
 * and pass through her once it is gone and she falls. Shots pass through stings.
 *
 * Stings exist only while she is in the world: she shoots them, and her defeat clears them. So a
 * tick without her skips the system, and a level without a boss pays nothing for it.
 */
function bossCollisionSystem(state: GameState): void {
  const { world, player, boss } = state;
  const id = boss.id;
  if (state.status !== 'playing' || id === undefined) {
    return;
  }
  for (let index = 0; index < world.count; index += 1) {
    const sting = world.at(index);
    if (
      world.kind[sting] === Kind.sting &&
      world.isAlive(sting) &&
      overlaps(state, player, sting)
    ) {
      world.kill(sting);
      hurtHero(state);
    }
  }
  if (boss.phase === 'charging' && !boss.struck && overlaps(state, player, id)) {
    boss.struck = true;
    hurtHero(state);
  }
  for (let index = 0; index < world.count && (world.health[id] as number) > 0; index += 1) {
    const shot = world.at(index);
    if (
      world.kind[shot] !== Kind.projectile ||
      !world.isAlive(shot) ||
      !overlaps(state, shot, id)
    ) {
      continue;
    }
    world.kill(shot);
    const health = healthAfterHit(world.health[id] as number);
    world.health[id] = health;
    state.events.emit('bossHit', { healthLeft: health });
  }
}

/**
 * Counts down the shield and rapid fire. It runs after the systems that read them and before a
 * pickup sets them, so each lasts exactly its duration in ticks.
 */
function powerUpTimerSystem(state: GameState): void {
  if (state.status !== 'playing') {
    return;
  }
  if (state.shieldTicks > 0) {
    state.shieldTicks -= 1;
  }
  if (state.rapidFireTicks > 0) {
    state.rapidFireTicks -= 1;
  }
}

/** Collects every power-up the hero touches, in world order (#151). */
function pickupSystem(state: GameState): void {
  if (state.status !== 'playing') {
    return;
  }
  const { world, player } = state;
  for (let index = 0; index < world.count; index += 1) {
    const id = world.at(index);
    if (world.kind[id] !== Kind.powerUp || !world.isAlive(id) || !overlaps(state, player, id)) {
      continue;
    }
    world.kill(id);
    const config = DROPS[world.variant[id] as number];
    if (config === undefined) {
      // Unreachable: a power-up's variant is always an index of `POWER_UPS`.
      continue;
    }
    collect(state, config);
    const half = POWER_UP_RULES.size * 0.5;
    state.events.emit('powerUpCollected', {
      kind: config.kind,
      x: (world.x[id] as number) + half,
      y: (world.y[id] as number) + half,
    });
  }
}

/** Applies a collected power-up, within the caps of the run's difficulty. */
function collect(state: GameState, config: PowerUpConfig): void {
  const preset = DIFFICULTIES[state.difficulty];
  switch (config.kind) {
    case 'ammo':
      state.ammo = addCapped(state.ammo, config.rounds, preset.ammo.max);
      break;
    case 'life':
      state.lives = addCapped(state.lives, config.lives, preset.lives);
      break;
    case 'shield':
      state.shieldTicks = config.durationTicks;
      break;
    case 'rapidFire':
      state.rapidFireTicks = config.durationTicks;
      state.fireCooldown = 0;
      break;
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
 * Ends the run when the hero is out of lives, and the level once all its waves are sent, no enemy
 * is left and its boss, if it has one, is beaten: the last level wins the run, any other is
 * cleared for the next (ADR-0017).
 */
function outcomeSystem(state: GameState): void {
  if (state.status !== 'playing') {
    return;
  }
  const level = state.levels[state.level - 1];
  const levelDone =
    level !== undefined &&
    state.wave >= level.waves.length &&
    !anyEnemyAlive(state) &&
    (level.boss === undefined || state.boss.phase === 'beaten');
  const status = statusFor(state.lives, levelDone, state.level >= state.levels.length);
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

/** Gives back a round of ammo at a fixed rate, up to the difficulty's maximum. */
function ammoSystem(state: GameState): void {
  if (state.status === 'playing') {
    state.ammo = ammoAfterTick(state.ammo, state.tick, DIFFICULTIES[state.difficulty].ammo.max);
  }
}

/**
 * Sends the enemies of the level's current wave at the wave's pace, after the level's calm before
 * each wave. Once the last wave is sent, the level's boss comes when no enemy is left (#152);
 * nothing else comes until the next level.
 */
function spawnSystem(state: GameState): void {
  if (state.status !== 'playing') {
    return;
  }
  const level = state.levels[state.level - 1];
  if (level === undefined) {
    return;
  }
  const wave = level.waves[state.wave];
  if (wave === undefined) {
    if (level.boss !== undefined && state.boss.phase === 'absent' && !anyEnemyAlive(state)) {
      spawnBoss(state, level.boss.health);
    }
    return;
  }
  state.spawnTimer -= 1;
  if (state.spawnTimer > 0) {
    return;
  }
  const preset = DIFFICULTIES[state.difficulty];
  spawnEnemy(state, wave, level.speedScale * preset.enemySpeed, preset.enemyLives);
  state.waveSent += 1;
  if (state.waveSent < wave.count) {
    state.spawnTimer = paced(wave.intervalTicks, preset.pace);
    return;
  }
  state.wave += 1;
  state.waveSent = 0;
  state.spawnTimer = paced(level.breakTicks, preset.pace);
}

/**
 * Spawns one enemy of the time's set at the right edge, with the rolls of the 2023 game, its speed
 * scaled and its lives offset by the level and the difficulty.
 */
function spawnEnemy(
  state: GameState,
  wave: WaveConfig,
  speedScale: number,
  livesOffset: number,
): void {
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
  const lives = enemyLivesWith(intInRange(config.lives, livesRoll), livesOffset);
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
 * Brings the level's boss in at the right edge, halfway down, with the level's health at the
 * difficulty (#152). A full world leaves her absent, and she tries again on the next tick.
 */
function spawnBoss(state: GameState, health: number): void {
  const { world, boss } = state;
  const id = world.spawn(Kind.boss, state.tick);
  if (id === undefined) {
    return;
  }
  const preset = DIFFICULTIES[state.difficulty];
  const { width, height } = BOSS.hitbox;
  const y = (WORLD.height - height) * 0.5;
  world.place(id, WORLD.width, y, width, height);
  world.vx[id] = -BOSS.enterSpeed * preset.enemySpeed;
  const maxHealth = bossHealthWith(health, preset.bossHealth);
  world.health[id] = maxHealth;
  world.value[id] = maxHealth;
  boss.phase = 'entering';
  boss.id = id;
  boss.phaseTicks = 0;
  boss.targetY = y;
  boss.struck = false;
  state.events.emit('bossEntered', { maxHealth });
}

/**
 * Runs the boss's fight (#152): her phase from the state machine, then what she does in it. It
 * runs before the movement, so the speeds she takes and the stings she shoots move in this tick.
 */
function bossSystem(state: GameState): void {
  const { boss, world } = state;
  const { id, phase } = boss;
  if (state.status !== 'playing' || id === undefined || phase === 'absent' || phase === 'beaten') {
    return;
  }
  boss.phaseTicks += 1;
  const next = nextBossPhase(
    {
      phase,
      phaseTicks: boss.phaseTicks,
      health: world.health[id] as number,
      maxHealth: world.value[id] as number,
      x: world.x[id] as number,
      width: world.width[id] as number,
    },
    BOSS_CLOCKS[state.difficulty],
  );
  if (next === 'beaten') {
    bossBeaten(state, id);
    return;
  }
  if (next !== phase) {
    enterBossPhase(state, id, phase, next);
  }
  switch (next) {
    case 'attacking':
      fight(state, id, BOSS.attacking);
      break;
    case 'enraged':
      fight(state, id, BOSS.enraged);
      break;
    case 'defeated':
      burst(state, id);
      break;
    case 'entering':
    case 'windup':
    case 'charging':
    case 'returning':
      // The speeds set on entering the phase do it all.
      break;
  }
}

/** What changes the tick the boss enters a phase. */
function enterBossPhase(state: GameState, id: EntityId, from: BossPhase, to: BossPhase): void {
  const { boss, world } = state;
  const speed = DIFFICULTIES[state.difficulty].enemySpeed;
  boss.phase = to;
  boss.phaseTicks = 0;
  switch (to) {
    case 'attacking':
    case 'enraged':
      // At her post: she has arrived, or come back from a charge, or her rage begins there.
      world.x[id] = BOSS.postX;
      world.vx[id] = 0;
      if (from === 'attacking') {
        state.events.emit('bossEnraged', { healthLeft: world.health[id] as number });
      }
      break;
    case 'windup':
      world.vx[id] = 0;
      world.vy[id] = 0;
      break;
    case 'charging':
      world.vx[id] = -BOSS.charge.speed * speed;
      boss.struck = false;
      break;
    case 'returning':
      world.place(
        id,
        WORLD.width,
        world.y[id] as number,
        world.width[id] as number,
        world.height[id] as number,
      );
      world.vx[id] = -BOSS.enterSpeed * speed;
      break;
    case 'defeated':
      defeatBoss(state, id);
      break;
    case 'entering':
      // Unreachable: she enters only when she arrives, in `spawnBoss`.
      break;
  }
}

/**
 * The boss attacking, calm or enraged: she glides toward a height she picks now and then, shoots
 * volleys and fans in turn, and calls broods. Her times follow the difficulty's pace and her
 * speeds its enemy speed.
 */
function fight(state: GameState, id: EntityId, config: BossPhaseConfig): void {
  const { boss, world, player } = state;
  const preset = DIFFICULTIES[state.difficulty];
  const ticks = boss.phaseTicks;
  if (ticks % paced(config.pickHeightTicks, preset.pace) === 0) {
    boss.targetY = state.rng.nextFloat() * (WORLD.height - (world.height[id] as number));
  }
  const step = config.moveSpeed * preset.enemySpeed;
  const dy = boss.targetY - (world.y[id] as number);
  world.vy[id] = dy > step ? step : dy < -step ? -step : dy;

  const attack = attackAt(ticks, paced(config.attackTicks, preset.pace), BOSS.volley);
  if (attack === 'volley') {
    const { muzzle, width, height, speed, maxSlope } = BOSS.sting;
    const from = {
      x: (world.x[id] as number) + muzzle.x + width * 0.5,
      y: (world.y[id] as number) + muzzle.y + height * 0.5,
    };
    const hero = {
      x: (world.x[player] as number) + (world.width[player] as number) * 0.5,
      y: (world.y[player] as number) + (world.height[player] as number) * 0.5,
    };
    shootSting(
      state,
      id,
      aimedSlope(from, hero, speed * preset.enemySpeed, maxSlope * preset.enemySpeed),
    );
  } else if (attack === 'fan') {
    for (const vy of config.fan) {
      shootSting(state, id, vy * preset.enemySpeed);
    }
  }

  if (ticks > 0 && ticks % paced(config.broodTicks, preset.pace) === 0) {
    const speedScale = (state.levels[state.level - 1]?.speedScale ?? 1) * preset.enemySpeed;
    for (let index = 0; index < BOSS.broodCount; index += 1) {
      spawnEnemy(state, BROOD, speedScale, preset.enemyLives);
    }
  }
}

/** A sting from the tip of the boss's own, flying left and climbing or falling by `vy`. */
function shootSting(state: GameState, boss: EntityId, vy: number): void {
  const { world } = state;
  const id = world.spawn(Kind.sting, state.tick);
  if (id === undefined) {
    return;
  }
  const { muzzle, width, height, speed } = BOSS.sting;
  world.place(
    id,
    (world.x[boss] as number) + muzzle.x,
    (world.y[boss] as number) + muzzle.y,
    width,
    height,
  );
  world.vx[id] = -speed * DIFFICULTIES[state.difficulty].enemySpeed;
  world.vy[id] = vy;
}

/**
 * The boss defeated: her stings vanish, and her brood, with every enemy left, explodes with her
 * and scores nothing. She scores her health and starts to fall.
 */
function defeatBoss(state: GameState, id: EntityId): void {
  const { world } = state;
  for (let index = 0; index < world.count; index += 1) {
    const other = world.at(index);
    if (!world.isAlive(other)) {
      continue;
    }
    if (world.kind[other] === Kind.sting) {
      world.kill(other);
    } else if (world.kind[other] === Kind.enemy) {
      world.kill(other);
      spawnExplosion(state, other);
    }
  }
  world.vx[id] = 0;
  world.vy[id] = BOSS.defeat.sinkSpeed;
  const value = world.value[id] as number;
  state.score = scoreAfterKill(state.score, value);
  state.events.emit('bossDefeated', {
    x: (world.x[id] as number) + (world.width[id] as number) * 0.5,
    y: (world.y[id] as number) + (world.height[id] as number) * 0.5,
    value,
  });
}

/** An explosion on the falling boss every few ticks, at the next place of `DEBRIS`. */
function burst(state: GameState, id: EntityId): void {
  const ticks = state.boss.phaseTicks;
  const every = BOSS.defeat.explosionTicks;
  if (ticks === 0 || ticks % every !== 0) {
    return;
  }
  const { world } = state;
  const [shareX, shareY] = DEBRIS[(ticks / every - 1) % DEBRIS.length] ?? DEBRIS[0];
  spawnExplosionAt(
    state,
    (world.x[id] as number) + (world.width[id] as number) * shareX,
    (world.y[id] as number) + (world.height[id] as number) * shareY,
  );
}

/** Her defeat has played out: the last explosions burst across her, and she leaves the world. */
function bossBeaten(state: GameState, id: EntityId): void {
  const { world, boss } = state;
  const x = world.x[id] as number;
  const width = world.width[id] as number;
  const centerY = (world.y[id] as number) + (world.height[id] as number) * 0.5;
  for (const share of FINAL_BURSTS) {
    spawnExplosionAt(state, x + width * share, centerY);
  }
  world.kill(id);
  boss.phase = 'beaten';
  boss.id = undefined;
  boss.phaseTicks = 0;
}

/**
 * Moves a cleared run on to the next level: its waves from the start, after its calm, at the
 * other time of day when the cleared level says so (ADR-0017). Not a system: the simulation calls
 * it at the start of the tick after a level is cleared.
 */
export function startNextLevel(state: GameState): void {
  const next = state.levels[state.level];
  if (next === undefined) {
    // Unreachable: clearing the last level wins the run instead.
    return;
  }
  const mode = timeAfterLevel(state.level, state.mode, state.levels);
  if (mode !== state.mode) {
    state.mode = mode;
    state.enemies = ENEMY_SETS[mode];
    state.enemyWeights = state.enemies.map((enemy) => enemy.weight);
  }
  state.level += 1;
  state.wave = 0;
  state.waveSent = 0;
  state.spawnTimer = paced(next.breakTicks, DIFFICULTIES[state.difficulty].pace);
  // The last level's boss was beaten and has left the world; the next level waits for its own.
  const { boss } = state;
  boss.phase = 'absent';
  boss.id = undefined;
  boss.phaseTicks = 0;
  boss.targetY = 0;
  boss.struck = false;
  state.status = 'playing';
  state.events.emit('levelStarted', { level: state.level, mode: state.mode });
}

/** The update order of one tick. */
export const SYSTEMS = [
  controlSystem,
  shootingSystem,
  bossSystem,
  movementSystem,
  lifetimeSystem,
  collisionSystem,
  bossCollisionSystem,
  powerUpTimerSystem,
  pickupSystem,
  outcomeSystem,
  ammoSystem,
  spawnSystem,
] as const satisfies readonly ((state: GameState, input: TickInput) => void)[];
