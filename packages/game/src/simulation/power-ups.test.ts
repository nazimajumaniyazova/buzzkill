import { createRng } from '@buzzkill/engine';
import { describe, expect, it, vi } from 'vitest';

import { DIFFICULTIES } from '../config/difficulty';
import {
  POWER_UP_RULES,
  POWER_UPS,
  type PowerUpConfig,
  type PowerUpKind,
  RAPID_FIRE,
  SHIELD,
} from '../config/power-ups';
import { type EntityId, Kind } from '../world/world';
import { pickWeighted } from './rules';
import { createSimulation, type Simulation } from './simulation';
import type { GameEvents, GameState, TickInput } from './state';

const IDLE: TickInput = { down: 0, pressed: 0 };
const DOWN: TickInput = { down: 2, pressed: 0 };
const FIRE: TickInput = { down: 4, pressed: 4 };
const HOLD_FIRE: TickInput = { down: 4, pressed: 0 };

const KINDS: readonly PowerUpConfig[] = POWER_UPS;
const WEIGHTS = KINDS.map(({ weight }) => weight);

/** A run in which no enemy comes unless a test puts it there. */
function setup(difficulty: 'easy' | 'normal' | 'hard' = 'normal'): Simulation {
  const sim = createSimulation({ seed: 1, heroId: 'male', mode: 'day', difficulty });
  sim.state.spawnTimer = Number.MAX_SAFE_INTEGER;
  return sim;
}

function run(sim: Simulation, ticks: number, input: TickInput = IDLE): void {
  for (let i = 0; i < ticks; i += 1) {
    sim.step(input);
  }
}

function ofKind(state: GameState, kind: number): EntityId[] {
  const { world } = state;
  return Array.from({ length: world.count }, (_, index) => world.at(index)).filter(
    (id) => world.kind[id] === kind,
  );
}

/** Puts a still enemy into the world. */
function addEnemy(sim: Simulation, x: number, y: number, health: number): EntityId {
  const { world, tick } = sim.state;
  const id = world.spawn(Kind.enemy, tick) as EntityId;
  world.place(id, x, y, 100, 100);
  world.health[id] = health;
  world.value[id] = health;
  return id;
}

/** Puts a still power-up of `kind` into the world, by default on the hero. */
function addPowerUp(sim: Simulation, kind: PowerUpKind, x = 60, y = 150): EntityId {
  const { world, tick } = sim.state;
  const id = world.spawn(Kind.powerUp, tick) as EntityId;
  world.place(id, x, y, POWER_UP_RULES.size, POWER_UP_RULES.size);
  world.variant[id] = KINDS.findIndex((config) => config.kind === kind);
  return id;
}

/**
 * Sets the RNG so that the next enemy destroyed by a shot drops `kind`, or nothing. A kill takes
 * three rolls in this order: the explosion, whether something drops, and what.
 */
function rigNextKill(sim: Simulation, kind: PowerUpKind | 'nothing'): void {
  for (let seed = 0; ; seed += 1) {
    const rng = createRng(seed);
    rng.nextFloat();
    const drops = rng.nextFloat() < POWER_UP_RULES.dropChance;
    const picked = KINDS[pickWeighted(WEIGHTS, rng.nextFloat())]?.kind;
    if (kind === 'nothing' ? !drops : drops && picked === kind) {
      sim.state.rng.setState(createRng(seed).getState());
      return;
    }
  }
}

/** Shoots an enemy of one life just past the hero, and steps until it is destroyed. */
function killEnemy(sim: Simulation, y = 150): void {
  addEnemy(sim, 200, y, 1);
  const destroyed = vi.fn();
  const off = sim.state.events.on('enemyDestroyed', destroyed);
  sim.step(FIRE);
  while (destroyed.mock.calls.length === 0) {
    sim.step(IDLE);
  }
  off();
}

describe('power-ups', () => {
  it('drop where a destroyed enemy was, when the roll says so, and drift left', () => {
    const sim = setup();
    rigNextKill(sim, 'shield');

    killEnemy(sim);

    const [id] = ofKind(sim.state, Kind.powerUp);
    expect(id).toBeDefined();
    const { world } = sim.state;
    const powerUp = id as EntityId;
    expect(world.variant[powerUp]).toBe(KINDS.findIndex(({ kind }) => kind === 'shield'));
    // Centered on the enemy's 100 x 100 box at (200, 150).
    expect([world.x[powerUp], world.y[powerUp]]).toEqual([234, 184]);
    expect([world.width[powerUp], world.height[powerUp]]).toEqual([32, 32]);
    expect(world.vx[powerUp]).toBe(-POWER_UP_RULES.speed);
  });

  it('do not drop when the roll says nothing', () => {
    const sim = setup();
    rigNextKill(sim, 'nothing');

    killEnemy(sim);

    expect(ofKind(sim.state, Kind.powerUp)).toEqual([]);
  });

  it('take the same three rolls on every kill, so a drop never shifts the later numbers', () => {
    const rngAfterKill = (kind: PowerUpKind | 'nothing') => {
      const sim = setup();
      rigNextKill(sim, kind);
      const before = createRng(0);
      before.setState(sim.state.rng.getState());
      for (let i = 0; i < 3; i += 1) {
        before.nextFloat();
      }
      killEnemy(sim);
      return [sim.state.rng.getState(), before.getState()];
    };

    for (const kind of ['nothing', 'ammo', 'life'] as const) {
      const [after, expected] = rngAfterKill(kind);
      expect(after).toEqual(expected);
    }
  });

  it('drop no lower than the bottom of the world, so the hero can always reach one', () => {
    const sim = setup();
    // The hero as low as it goes, its muzzle at y = 683.
    run(sim, 130, DOWN);
    rigNextKill(sim, 'ammo');

    // An enemy in the line of fire, its center 8 px above the bottom edge.
    killEnemy(sim, 662);

    const [id] = ofKind(sim.state, Kind.powerUp);
    expect(sim.state.world.y[id as EntityId]).toBe(720 - 32);
  });

  it('leave the world past the left edge when nobody collects them', () => {
    const sim = setup();
    const id = addPowerUp(sim, 'ammo', 600, 600);
    sim.state.world.vx[id] = -POWER_UP_RULES.speed;

    run(sim, Math.ceil((600 + 32) / POWER_UP_RULES.speed));

    expect(ofKind(sim.state, Kind.powerUp)).toEqual([]);
  });

  it('are collected by touching the hero, which reports the kind and where it was', () => {
    const sim = setup();
    const collected = vi.fn<(payload: GameEvents['powerUpCollected']) => void>();
    sim.state.events.on('powerUpCollected', collected);
    addPowerUp(sim, 'ammo', 60, 150);

    sim.step(IDLE);

    expect(collected).toHaveBeenCalledExactlyOnceWith({ kind: 'ammo', x: 76, y: 166 });
    expect(ofKind(sim.state, Kind.powerUp)).toEqual([]);
  });

  it('are not hit by shots and do not hurt the hero', () => {
    const sim = setup();
    const id = addPowerUp(sim, 'shield', 250, 180);

    sim.step(FIRE);
    run(sim, 30);

    expect(sim.state.world.isAlive(id)).toBe(true);
    expect(sim.state.lives).toBe(5);
  });

  it('give 15 rounds, up to the most the difficulty allows', () => {
    const sim = setup('hard');
    sim.state.ammo = 10;
    addPowerUp(sim, 'ammo');
    sim.step(IDLE);
    expect(sim.state.ammo).toBe(25);

    addPowerUp(sim, 'ammo');
    addPowerUp(sim, 'ammo', 60, 200);
    sim.step(IDLE);
    expect(sim.state.ammo).toBe(DIFFICULTIES.hard.ammo.max);
  });

  it('give a life, never more than the run started with', () => {
    const sim = setup('easy');
    sim.state.lives = 5;
    addPowerUp(sim, 'life');
    sim.step(IDLE);
    expect(sim.state.lives).toBe(6);

    for (let i = 0; i < 3; i += 1) {
      addPowerUp(sim, 'life');
      sim.step(IDLE);
    }
    expect(sim.state.lives).toBe(DIFFICULTIES.easy.lives);
  });

  it('shield the hero for 10 s: an enemy that flies in explodes and takes no life', () => {
    const sim = setup();
    const hits = vi.fn();
    const explosions = vi.fn();
    sim.state.events.on('playerHit', hits);
    sim.state.events.on('explosion', explosions);
    addPowerUp(sim, 'shield');
    sim.step(IDLE);
    expect(sim.state.shieldTicks).toBe(SHIELD.durationTicks);

    // The last tick of the shield still blocks.
    run(sim, SHIELD.durationTicks - 1);
    addEnemy(sim, 30, 110, 3);
    sim.step(IDLE);
    expect(sim.state.lives).toBe(5);
    expect(hits).not.toHaveBeenCalled();
    expect(explosions).toHaveBeenCalledOnce();
    expect(ofKind(sim.state, Kind.enemy)).toEqual([]);
    expect(sim.state.shieldTicks).toBe(0);

    // Then it is gone.
    addEnemy(sim, 30, 110, 3);
    sim.step(IDLE);
    expect(sim.state.lives).toBe(4);
    expect(hits).toHaveBeenCalledExactlyOnceWith({ livesLeft: 4 });
  });

  it('start the time of a shield over when another is collected, without adding them up', () => {
    const sim = setup();
    addPowerUp(sim, 'shield');
    sim.step(IDLE);
    run(sim, 100);
    expect(sim.state.shieldTicks).toBe(SHIELD.durationTicks - 100);

    addPowerUp(sim, 'shield');
    sim.step(IDLE);
    expect(sim.state.shieldTicks).toBe(SHIELD.durationTicks);
  });

  it('fire every 6 ticks while fire is held during rapid fire, at no cost in rounds', () => {
    const sim = setup();
    const shots: number[] = [];
    sim.state.events.on('shot', () => {
      shots.push(sim.state.tick);
    });
    const full = DIFFICULTIES.normal.ammo.max;
    sim.state.ammo = full;
    addPowerUp(sim, 'rapidFire');
    sim.step(IDLE);
    const start = sim.state.tick;

    sim.step(FIRE);
    run(sim, 30, HOLD_FIRE);

    expect(shots.map((tick) => tick - start)).toEqual([1, 7, 13, 19, 25, 31]);
    expect(sim.state.ammo).toBe(full);
  });

  it('fire no faster during rapid fire however often fire is pressed, even with no rounds', () => {
    const sim = setup();
    const shots: number[] = [];
    sim.state.events.on('shot', () => {
      shots.push(sim.state.tick);
    });
    sim.state.ammo = 0;
    addPowerUp(sim, 'rapidFire');
    sim.step(IDLE);
    const start = sim.state.tick;

    // A press every other tick, as fast as a turbo button.
    for (let i = 0; i < 15; i += 1) {
      sim.step(FIRE);
      sim.step(IDLE);
    }

    expect(shots.map((tick) => tick - start)).toEqual([1, 7, 13, 19, 25]);
    expect(RAPID_FIRE.intervalTicks).toBe(6);
  });

  it('end rapid fire after 8 s: holding fire shoots no more, and a press costs a round again', () => {
    const sim = setup();
    const shots = vi.fn();
    sim.state.events.on('shot', shots);
    addPowerUp(sim, 'rapidFire');
    sim.step(IDLE);
    run(sim, RAPID_FIRE.durationTicks);
    expect(sim.state.rapidFireTicks).toBe(0);
    const ammo = sim.state.ammo;

    sim.step(FIRE);
    expect(sim.state.ammo).toBe(ammo - 1);
    run(sim, 30, HOLD_FIRE);

    expect(shots).toHaveBeenCalledOnce();
  });

  it('are not collected and do not count down once the run is over', () => {
    const sim = setup();
    addPowerUp(sim, 'shield');
    sim.step(IDLE);
    sim.state.lives = 1;
    sim.state.shieldTicks = 0;
    addEnemy(sim, 30, 110, 1);
    sim.step(IDLE);
    expect(sim.state.status).toBe('lost');

    sim.state.shieldTicks = 50;
    addPowerUp(sim, 'life');
    run(sim, 10);

    expect(sim.state.lives).toBe(0);
    expect(sim.state.shieldTicks).toBe(50);
    expect(ofKind(sim.state, Kind.powerUp)).toHaveLength(1);
  });
});
