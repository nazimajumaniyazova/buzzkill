// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it, vi } from 'vitest';

import { DIFFICULTIES, type Difficulty } from '../config/difficulty';
import { NIGHT_ENEMIES } from '../config/enemies';
import { LEVELS } from '../config/levels';
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

/** The level being played. */
const levelOf = (state: GameState) => LEVELS[state.level - 1] ?? LEVELS[0];

/** Enemies the current level has sent so far. */
const sentSoFar = (state: GameState) =>
  levelOf(state)
    .waves.slice(0, state.wave)
    .reduce((sum, wave) => sum + wave.count, 0) + state.waveSent;

/** Marks every wave of the current level as sent: the level ends once its enemies are gone. */
function sendEveryWave(sim: Simulation): void {
  sim.state.wave = levelOf(sim.state).waves.length;
}

describe('createSimulation', () => {
  it('starts a run with the 2023 numbers, on the first level, at the chosen time of day', () => {
    const { state } = setup();

    expect(state.status).toBe('playing');
    expect([state.score, state.lives, state.ammo, state.tick]).toEqual([0, 5, 20, 0]);
    expect([state.level, state.wave, state.mode]).toEqual([1, 0, 'day']);
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

  it("spawns the first enemy at the right edge after the first level's calm", () => {
    const sim = setup();

    run(sim, LEVELS[0].breakTicks - 1);
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

  it('sends each wave at its pace, with the calm before each wave', () => {
    const sim = setup();
    // Idle, the hero is in the way of some enemies; enough lives to see two waves through.
    sim.state.lives = 99;
    const [first, second] = LEVELS[0].waves;
    const sentAt: number[] = [];
    while (sentAt.length < first.count + 2) {
      const before = sentSoFar(sim.state);
      sim.step(IDLE);
      if (sentSoFar(sim.state) > before) {
        sentAt.push(sim.state.tick);
      }
    }

    const { breakTicks } = LEVELS[0];
    const firstWave = Array.from(
      { length: first.count },
      (_, index) => breakTicks + index * first.intervalTicks,
    );
    const secondWaveStart = (firstWave.at(-1) ?? 0) + breakTicks;
    expect(sentAt).toEqual([...firstWave, secondWaveStart, secondWaveStart + second.intervalTicks]);
  });

  it('waits for the last enemies of a level to be destroyed or to leave', () => {
    const sim = setup();
    sendEveryWave(sim);
    addEnemy(sim, 900, 400, 1);

    run(sim, 10);

    expect(sim.state.status).toBe('playing');
  });

  it('clears a level once its waves are sent and no enemy is left, and starts the next one on the next tick', () => {
    const sim = setup();
    const cleared = vi.fn<(payload: GameEvents['levelCleared']) => void>();
    const started = vi.fn<(payload: GameEvents['levelStarted']) => void>();
    sim.state.events.on('levelCleared', cleared);
    sim.state.events.on('levelStarted', started);
    sim.state.score = 12;
    sendEveryWave(sim);

    sim.step(IDLE);
    expect(sim.state.status).toBe('levelCleared');
    expect(cleared).toHaveBeenCalledExactlyOnceWith({ level: 1, score: 12 });
    expect(started).not.toHaveBeenCalled();

    sim.step(IDLE);
    expect(sim.state.status).toBe('playing');
    expect([sim.state.level, sim.state.wave, sim.state.waveSent]).toEqual([2, 0, 0]);
    expect(started).toHaveBeenCalledExactlyOnceWith({ level: 2, mode: 'day' });
    expect(sim.state.score).toBe(12);
  });

  it('changes the time of day after a level that says so, with the enemies of that time', () => {
    const sim = setup();
    const started = vi.fn<(payload: GameEvents['levelStarted']) => void>();
    sim.state.events.on('levelStarted', started);
    sim.state.level = LEVELS.findIndex((level) => level.timeChangesAfter) + 1;
    sendEveryWave(sim);

    run(sim, 2);

    expect(sim.state.mode).toBe('night');
    expect(sim.state.enemies).toBe(NIGHT_ENEMIES);
    expect(started).toHaveBeenCalledExactlyOnceWith({ level: 4, mode: 'night' });
  });

  it('wins the run when the last level is cleared, then stops spawning and scoring', () => {
    const sim = setup();
    const over = vi.fn<(payload: GameEvents['gameOver']) => void>();
    sim.state.events.on('gameOver', over);
    sim.state.level = LEVELS.length;
    sim.state.score = 150;
    sendEveryWave(sim);

    sim.step(IDLE);
    expect(sim.state.status).toBe('won');
    expect(over).toHaveBeenCalledExactlyOnceWith({ result: 'won', score: 150 });

    addEnemy(sim, 200, 150, 1, 50);
    run(sim, 400, FIRE);
    expect(sim.state.score).toBe(150);
    expect(sim.state.level).toBe(LEVELS.length);
  });

  it('starts with the lives and ammo of the difficulty, normal by default', () => {
    const start = (difficulty?: Difficulty) => {
      const { state } = createSimulation({
        seed: 1,
        heroId: 'male',
        mode: 'day',
        ...(difficulty === undefined ? {} : { difficulty }),
      });
      return [state.difficulty, state.lives, state.ammo];
    };

    expect(start()).toEqual(['normal', 5, 20]);
    expect(start('easy')).toEqual(['easy', DIFFICULTIES.easy.lives, DIFFICULTIES.easy.ammo.start]);
    expect(start('hard')).toEqual(['hard', DIFFICULTIES.hard.lives, DIFFICULTIES.hard.ammo.start]);
  });

  it('paces, speeds and toughens the enemies by the difficulty', () => {
    const firstEnemy = (difficulty: Difficulty) => {
      const sim = createSimulation({ seed: 9, heroId: 'male', mode: 'day', difficulty });
      while (ofKind(sim.state, Kind.enemy).length === 0) {
        sim.step(IDLE);
      }
      const id = ofKind(sim.state, Kind.enemy)[0] as EntityId;
      const { world } = sim.state;
      return {
        tick: sim.state.tick,
        vx: world.vx[id] as number,
        lives: world.health[id] as number,
      };
    };
    const easy = firstEnemy('easy');
    const normal = firstEnemy('normal');
    const hard = firstEnemy('hard');

    // The same seed rolls the same enemy; the difficulty scales it.
    expect([easy.tick, normal.tick, hard.tick]).toEqual([
      Math.round(LEVELS[0].breakTicks * DIFFICULTIES.easy.pace),
      LEVELS[0].breakTicks,
      Math.round(LEVELS[0].breakTicks * DIFFICULTIES.hard.pace),
    ]);
    expect(easy.vx).toBeCloseTo(normal.vx * DIFFICULTIES.easy.enemySpeed, 10);
    expect(hard.vx).toBeCloseTo(normal.vx * DIFFICULTIES.hard.enemySpeed, 10);
    expect(hard.lives).toBe(normal.lives + DIFFICULTIES.hard.enemyLives);
    expect(easy.lives).toBe(Math.max(1, normal.lives + DIFFICULTIES.easy.enemyLives));
  });

  it('refills ammo up to the maximum of the difficulty', () => {
    const sim = createSimulation({ seed: 1, heroId: 'male', mode: 'day', difficulty: 'hard' });
    sim.state.ammo = DIFFICULTIES.hard.ammo.max - 1;

    run(sim, 100);

    expect(sim.state.ammo).toBe(DIFFICULTIES.hard.ammo.max);
  });

  it("sends a later level's enemies faster", () => {
    const firstVx = (level: number) => {
      const sim = setup(5);
      sim.state.level = level;
      sim.state.spawnTimer = 1;
      sim.step(IDLE);
      const [enemy] = ofKind(sim.state, Kind.enemy);
      return sim.state.world.vx[enemy as EntityId] as number;
    };

    const last = LEVELS.length;
    expect(firstVx(last)).toBeCloseTo(firstVx(1) * (LEVELS[last - 1]?.speedScale ?? 0), 10);
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

  it('plays the campaign it is given, and refuses one without levels', () => {
    const level = { breakTicks: 7, speedScale: 1, timeChangesAfter: false, waves: [] };
    const sim = createSimulation({ seed: 1, heroId: 'male', mode: 'day', levels: [level] });

    expect(sim.state.levels).toEqual([level]);
    expect(sim.state.spawnTimer).toBe(7);
    sim.step(IDLE);
    expect(sim.state.status).toBe('won');
    expect(() => createSimulation({ seed: 1, heroId: 'male', mode: 'day', levels: [] })).toThrow(
      RangeError,
    );
  });
});
