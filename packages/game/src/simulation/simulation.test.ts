// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it, vi } from 'vitest';

import { HEROES, RULES, WORLD } from '../config/rules';
import { type EntityId, Kind } from '../world/world';
import { createSimulation, type Simulation } from './simulation';
import type { GameEvents, GameState, TickInput } from './state';

const IDLE: TickInput = { down: 0, pressed: 0 };
const UP: TickInput = { down: 1, pressed: 0 };
const DOWN: TickInput = { down: 2, pressed: 0 };
const BOTH: TickInput = { down: 3, pressed: 0 };
const FIRE: TickInput = { down: 4, pressed: 4 };
const HOLD_FIRE: TickInput = { down: 4, pressed: 0 };

function setup(seed = 1): Simulation {
  return createSimulation({ seed, heroId: 'male', mode: 'day' });
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

/** Puts a still enemy into the world, for collision scenarios. */
function addEnemy(sim: Simulation, x: number, y: number, health: number, value = health): EntityId {
  const { world, tick } = sim.state;
  const id = world.spawn(Kind.enemy, tick) as EntityId;
  world.place(id, x, y, 100, 100);
  world.health[id] = health;
  world.value[id] = value;
  return id;
}

const player = (sim: Simulation) => sim.state.player;

describe('createSimulation', () => {
  it('starts a run with the 2023 numbers', () => {
    const { state } = setup();

    expect(state.status).toBe('playing');
    expect([state.score, state.lives, state.ammo, state.tick]).toEqual([0, 5, 20, 0]);
    expect(state.world.x[state.player]).toBe(20);
    expect(state.world.y[state.player]).toBe(100);
    expect(state.world.width[state.player]).toBe(HEROES.male.width);
  });

  it('moves the hero 4 px per tick, up winning over down, and stops when nothing is held', () => {
    const sim = setup();
    const { world } = sim.state;

    sim.step(DOWN);
    expect(world.y[player(sim)]).toBe(104);
    sim.step(UP);
    sim.step(BOTH);
    expect(world.y[player(sim)]).toBe(96);
    expect(world.prevY[player(sim)]).toBe(100);
    sim.step(IDLE);
    expect(world.y[player(sim)]).toBe(96);
  });

  it('keeps the hero within 20 % of its height past the top and the bottom edge', () => {
    const sim = setup();
    const { world } = sim.state;
    const height = HEROES.male.height;

    run(sim, 200, UP);
    expect(world.y[player(sim)]).toBeCloseTo(-height * 0.2);
    run(sim, 300, DOWN);
    expect(world.y[player(sim)]).toBeCloseTo(WORLD.height - height * 0.8);
  });

  it('fires one projectile per press from the muzzle, costing one round', () => {
    const sim = setup();
    const shot = vi.fn();
    sim.state.events.on('shot', shot);

    sim.step(FIRE);
    sim.step(HOLD_FIRE);

    const projectiles = ofKind(sim.state, Kind.projectile);
    expect(projectiles).toHaveLength(1);
    expect(sim.state.ammo).toBe(19);
    expect(shot).toHaveBeenCalledExactlyOnceWith({ x: 20 + 105, y: 100 + 90 });
  });

  it('does not fire without ammo', () => {
    const sim = setup();
    sim.state.ammo = 0;

    sim.step(FIRE);

    expect(ofKind(sim.state, Kind.projectile)).toHaveLength(0);
  });

  it('removes a projectile once it passes 80 % of the world width', () => {
    const sim = setup();
    sim.step(FIRE);
    const range = WORLD.width * RULES.projectile.rangeRatio;
    // The projectile moved 4 px in the tick it was fired.
    const ticksToRange = Math.floor((range - (125 + 4)) / RULES.projectile.speed) + 1;

    run(sim, ticksToRange - 1);
    expect(ofKind(sim.state, Kind.projectile)).toHaveLength(1);
    run(sim, 1);
    expect(ofKind(sim.state, Kind.projectile)).toHaveLength(0);
  });

  it('spawns the first enemy at the right edge after 1.7 s', () => {
    const sim = setup();

    run(sim, RULES.spawn.intervalTicks - 1);
    expect(ofKind(sim.state, Kind.enemy)).toHaveLength(0);

    run(sim, 1);
    const [enemy] = ofKind(sim.state, Kind.enemy);
    expect(enemy).toBeDefined();
    const { world } = sim.state;
    const id = enemy as EntityId;
    expect(world.x[id]).toBe(WORLD.width);
    expect(world.vx[id]).toBeLessThanOrEqual(-1.5);
    expect(world.health[id]).toBeGreaterThanOrEqual(1);
    expect(world.value[id]).toBe(world.health[id]);
  });

  it('destroys an enemy with enough hits, scores its value and leaves an explosion', () => {
    const sim = setup();
    const enemy = addEnemy(sim, 300, 150, 2, 3);
    const destroyed = vi.fn();
    const hit = vi.fn();
    sim.state.events.on('enemyDestroyed', destroyed);
    sim.state.events.on('enemyHit', hit);

    sim.step(FIRE);
    run(sim, 60);
    expect(hit).toHaveBeenCalledExactlyOnceWith({ id: enemy, healthLeft: 1 });
    expect(sim.state.score).toBe(0);

    sim.step(FIRE);
    run(sim, 60);
    expect(sim.state.score).toBe(3);
    expect(destroyed).toHaveBeenCalledOnce();
    expect(ofKind(sim.state, Kind.projectile)).toHaveLength(0);
  });

  it('lets an explosion drift left and vanish after its 36 ticks', () => {
    const sim = setup();
    // The hero's box ends near x = 180; the enemy sits just past it, in the line of fire.
    addEnemy(sim, 200, 150, 1);
    sim.step(FIRE);
    while (ofKind(sim.state, Kind.explosion).length === 0) {
      sim.step(IDLE);
    }
    const id = ofKind(sim.state, Kind.explosion)[0] as EntityId;
    const startX = sim.state.world.x[id] as number;

    run(sim, 35);
    expect(sim.state.world.x[id]).toBe(startX - 35);
    run(sim, 1);
    expect(ofKind(sim.state, Kind.explosion)).toHaveLength(0);
  });

  it('costs a life when an enemy flies into the hero, and ends the run at zero', () => {
    const sim = setup();
    const hits = vi.fn<(payload: GameEvents['playerHit']) => void>();
    const over = vi.fn<(payload: GameEvents['gameOver']) => void>();
    sim.state.events.on('playerHit', hits);
    sim.state.events.on('gameOver', over);

    for (let life = 5; life > 0; life -= 1) {
      addEnemy(sim, 30, 110, 1);
      sim.step(IDLE);
    }

    expect(hits.mock.calls.map(([payload]) => payload)).toEqual([
      { livesLeft: 4 },
      { livesLeft: 3 },
      { livesLeft: 2 },
      { livesLeft: 1 },
      { livesLeft: 0 },
    ]);
    expect(sim.state.status).toBe('lost');
    expect(over).toHaveBeenCalledExactlyOnceWith({ result: 'lost', score: 0 });
  });

  it('wins once the score passes 100 and then stops spawning and scoring', () => {
    const sim = setup();
    sim.state.score = 100;
    addEnemy(sim, 200, 150, 1, 1);
    sim.step(FIRE);
    run(sim, 30);
    expect(sim.state.status).toBe('won');

    addEnemy(sim, 200, 150, 1, 50);
    run(sim, 400, FIRE);
    expect(sim.state.score).toBe(101);
    expect(ofKind(sim.state, Kind.enemy)).toHaveLength(1);
  });

  it('skips spawns when the world is full instead of failing', () => {
    const sim = createSimulation({ seed: 3, heroId: 'female', mode: 'night', capacity: 2 });

    run(sim, 1000);

    expect(sim.state.world.count).toBeLessThanOrEqual(2);
  });

  test.prop([
    fc.nat({ max: 0xff_ff_ff_ff }),
    fc.array(fc.nat({ max: 7 }), { minLength: 1, maxLength: 1500 }),
  ])('replays bit for bit: the same seed and inputs give the same state', (seed, downs) => {
    const play = () => {
      const sim = createSimulation({ seed, heroId: 'male', mode: 'night' });
      let previous = 0;
      for (const down of downs) {
        sim.step({ down, pressed: down & ~previous });
        previous = down;
      }
      const { state } = sim;
      const { world } = state;
      return {
        summary: [state.tick, state.status, state.score, state.lives, state.ammo],
        rng: state.rng.getState(),
        live: Array.from({ length: world.count }, (_, index) => {
          const id = world.at(index);
          return [id, world.kind[id], world.x[id], world.y[id], world.health[id]];
        }),
      };
    };

    expect(play()).toEqual(play());
  });

  it('gives different runs for different seeds', () => {
    const enemiesAfter = (seed: number) => {
      const sim = setup(seed);
      run(sim, 1500);
      const { world } = sim.state;
      return ofKind(sim.state, Kind.enemy).map((id) => world.y[id]);
    };

    expect(enemiesAfter(1)).not.toEqual(enemiesAfter(2));
  });
});
