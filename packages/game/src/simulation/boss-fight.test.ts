import { describe, expect, it, vi } from 'vitest';

import { type BossConfig, QUEEN } from '../config/boss';
import type { LevelConfig } from '../config/levels';
import { WORLD } from '../config/rules';
import { hashGameState } from '../replay/result';
import { type EntityId, Kind } from '../world/world';
import { aimedSlope, type BossPhase } from './boss';
import { createSimulation, type Simulation } from './simulation';
import type { GameEvents, GameState, TickInput } from './state';

const BOSS: BossConfig = QUEEN;
const IDLE: TickInput = { down: 0, pressed: 0 };

/** A level of nothing but the queen: she arrives on the first tick. */
const QUEEN_LEVEL: LevelConfig = {
  breakTicks: 1,
  speedScale: 1,
  timeChangesAfter: false,
  waves: [],
  boss: { health: 9 },
};

interface SetupOptions {
  readonly health?: number;
  readonly difficulty?: 'easy' | 'normal' | 'hard';
  readonly levels?: readonly LevelConfig[];
  /** Keeps the hero safe from her stings, for tests about something else. */
  readonly shielded?: boolean;
}

function setup({ health = 9, difficulty, levels, shielded = false }: SetupOptions = {}) {
  const sim = createSimulation({
    seed: 3,
    heroId: 'male',
    mode: 'day',
    ...(difficulty === undefined ? {} : { difficulty }),
    levels: levels ?? [{ ...QUEEN_LEVEL, boss: { health } }],
  });
  if (shielded) {
    sim.state.shieldTicks = Number.MAX_SAFE_INTEGER;
  }
  return sim;
}

function run(sim: Simulation, ticks: number, input: TickInput = IDLE): void {
  for (let i = 0; i < ticks; i += 1) {
    sim.step(input);
  }
}

/** Steps until `done` holds, and returns how many ticks that took. */
function runUntil(sim: Simulation, done: (state: GameState) => boolean, limit = 5000): number {
  for (let ticks = 1; ticks <= limit; ticks += 1) {
    sim.step(IDLE);
    if (done(sim.state)) {
      return ticks;
    }
  }
  throw new Error(`runUntil: not done after ${String(limit)} ticks`);
}

const inPhase = (phase: BossPhase) => (state: GameState) => state.boss.phase === phase;

function queen(sim: Simulation): EntityId {
  const id = sim.state.boss.id;
  if (id === undefined) {
    throw new Error('the queen is not in the world');
  }
  return id;
}

function ofKind(state: GameState, kind: number): EntityId[] {
  const { world } = state;
  return Array.from({ length: world.count }, (_, index) => world.at(index)).filter(
    (id) => world.kind[id] === kind && world.isAlive(id),
  );
}

function listen<K extends keyof GameEvents>(sim: Simulation, event: K) {
  const handler = vi.fn<(payload: GameEvents[K]) => void>();
  sim.state.events.on(event, handler);
  return handler;
}

/** Puts an entity of `kind` into the world, still, with its top-left at (x, y). */
function add(sim: Simulation, kind: Kind, x: number, y: number, width: number, height: number) {
  const { world, tick } = sim.state;
  const id = world.spawn(kind, tick);
  if (id === undefined) {
    throw new Error('the world is full');
  }
  world.place(id, x, y, width, height);
  return id;
}

/** A shot already inside the queen's box: it hits her in the next tick's collisions. */
function shotIntoQueen(sim: Simulation): EntityId {
  const { world } = sim.state;
  const id = queen(sim);
  return add(
    sim,
    Kind.projectile,
    (world.x[id] as number) + 20,
    (world.y[id] as number) + 100,
    10,
    3,
  );
}

describe('the queen arriving', () => {
  it('flies in at the right edge, halfway down, once every wave is sent and no enemy is left', () => {
    const sim = setup();
    const entered = listen(sim, 'bossEntered');

    sim.step(IDLE);

    const { world, boss } = sim.state;
    const id = queen(sim);
    expect(boss.phase).toBe('entering');
    expect(world.kind[id]).toBe(Kind.boss);
    expect([world.x[id], world.y[id], world.width[id], world.height[id]]).toEqual([
      WORLD.width,
      (WORLD.height - BOSS.hitbox.height) / 2,
      BOSS.hitbox.width,
      BOSS.hitbox.height,
    ]);
    expect([world.health[id], world.value[id]]).toEqual([9, 9]);
    expect(entered.mock.calls).toEqual([[{ maxHealth: 9 }]]);
  });

  it('waits for the enemies still in the world', () => {
    const sim = setup();
    const enemy = add(sim, Kind.enemy, 600, 300, 100, 100);
    sim.state.world.health[enemy] = 1;

    run(sim, 10);
    expect(sim.state.boss.phase).toBe('absent');

    sim.state.world.kill(enemy);
    run(sim, 2);
    expect(sim.state.boss.phase).toBe('entering');
  });

  it('comes with the health of the level at the difficulty', () => {
    const health = (difficulty: 'easy' | 'normal' | 'hard') => {
      const sim = setup({ health: 60, difficulty });
      sim.step(IDLE);
      return sim.state.world.value[queen(sim)];
    };

    expect([health('easy'), health('normal'), health('hard')]).toEqual([45, 60, 75]);
  });

  it('stops at her post and attacks from there', () => {
    const sim = setup({ shielded: true });

    const ticks = runUntil(sim, inPhase('attacking'));

    const { world } = sim.state;
    // A tick to arrive, the ticks of her flight, and the tick her machine finds her at her post.
    expect(ticks).toBe(1 + Math.ceil((WORLD.width - BOSS.postX) / BOSS.enterSpeed) + 1);
    expect([world.x[queen(sim)], world.vx[queen(sim)]]).toEqual([BOSS.postX, 0]);
  });

  it('holds the level open while she is in it', () => {
    const sim = setup({ shielded: true });

    run(sim, 600);

    expect(sim.state.status).toBe('playing');
  });
});

describe('the queen attacking', () => {
  /** The hero's center, where a volley aims. */
  function heroCenter(state: GameState) {
    const { world, player } = state;
    return {
      x: (world.x[player] as number) + (world.width[player] as number) / 2,
      y: (world.y[player] as number) + (world.height[player] as number) / 2,
    };
  }

  it('waits one attack, then shoots a volley of stings a gap apart, each aimed at the hero', () => {
    const sim = setup({ shielded: true });
    runUntil(sim, inPhase('attacking'));
    const { world } = sim.state;
    const { attackTicks } = BOSS.attacking;
    const { gapTicks, count } = BOSS.volley;

    run(sim, attackTicks - 1);
    expect(ofKind(sim.state, Kind.sting)).toEqual([]);

    for (let shot = 1; shot <= count; shot += 1) {
      run(sim, shot === 1 ? 0 : gapTicks - 1);
      // She shoots before she moves in a tick, from where the tick finds her.
      const herY = world.y[queen(sim)] as number;
      sim.step(IDLE);
      const stings = ofKind(sim.state, Kind.sting);
      expect(stings).toHaveLength(shot);
      const sting = stings.at(-1) as EntityId;
      const from = {
        x: BOSS.postX + BOSS.sting.muzzle.x + BOSS.sting.width / 2,
        y: herY + BOSS.sting.muzzle.y + BOSS.sting.height / 2,
      };
      expect([world.prevX[sting], world.prevY[sting]]).toEqual([
        BOSS.postX + BOSS.sting.muzzle.x,
        herY + BOSS.sting.muzzle.y,
      ]);
      expect([world.width[sting], world.height[sting], world.vx[sting]]).toEqual([
        BOSS.sting.width,
        BOSS.sting.height,
        -BOSS.sting.speed,
      ]);
      expect(world.vy[sting]).toBe(
        aimedSlope(from, heroCenter(sim.state), BOSS.sting.speed, BOSS.sting.maxSlope),
      );
    }
  });

  it('shoots a fan the next attack', () => {
    const sim = setup({ shielded: true });
    runUntil(sim, inPhase('attacking'));
    const { attackTicks } = BOSS.attacking;
    run(sim, attackTicks * 2 - 1);
    const before = new Set(ofKind(sim.state, Kind.sting));

    sim.step(IDLE);

    const fan = ofKind(sim.state, Kind.sting).filter((id) => !before.has(id));
    expect(fan.map((id) => sim.state.world.vy[id])).toEqual(BOSS.attacking.fan);
  });

  it('calls a brood of enemies from the right edge', () => {
    const sim = setup({ shielded: true });
    runUntil(sim, inPhase('attacking'));
    run(sim, BOSS.attacking.broodTicks - 1);
    expect(ofKind(sim.state, Kind.enemy)).toEqual([]);

    sim.step(IDLE);

    const brood = ofKind(sim.state, Kind.enemy);
    expect(brood).toHaveLength(BOSS.broodCount);
    expect(brood.map((id) => sim.state.world.prevX[id])).toEqual([WORLD.width, WORLD.width]);
  });

  it('glides between heights within the world', () => {
    const sim = setup({ shielded: true });
    runUntil(sim, inPhase('attacking'));
    const { world } = sim.state;
    const heights = new Set<number>();

    for (let tick = 0; tick < 600; tick += 1) {
      sim.step(IDLE);
      const y = world.y[queen(sim)] as number;
      heights.add(Math.round(y));
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y + BOSS.hitbox.height).toBeLessThanOrEqual(WORLD.height);
      expect(Math.abs(world.vy[queen(sim)] as number)).toBeLessThanOrEqual(
        BOSS.attacking.moveSpeed,
      );
    }
    expect(heights.size).toBeGreaterThan(10);
  });
});

describe('her stings', () => {
  it('take a life from the hero they strike, and are gone', () => {
    const sim = setup();
    sim.step(IDLE);
    const hit = listen(sim, 'playerHit');
    const { world, player } = sim.state;
    const sting = add(
      sim,
      Kind.sting,
      world.x[player] as number,
      world.y[player] as number,
      32,
      12,
    );

    sim.step(IDLE);

    expect(sim.state.lives).toBe(4);
    expect(hit.mock.calls).toEqual([[{ livesLeft: 4 }]]);
    expect(world.isAlive(sting)).toBe(false);
  });

  it('break on a shield', () => {
    const sim = setup({ shielded: true });
    sim.step(IDLE);
    const hit = listen(sim, 'playerHit');
    const { world, player } = sim.state;
    const sting = add(
      sim,
      Kind.sting,
      world.x[player] as number,
      world.y[player] as number,
      32,
      12,
    );

    sim.step(IDLE);

    expect(sim.state.lives).toBe(5);
    expect(hit).not.toHaveBeenCalled();
    expect(world.isAlive(sting)).toBe(false);
  });

  it("let the hero's shots through, and leave the world past its edges", () => {
    const sim = setup({ shielded: true });
    const { world } = sim.state;
    const sting = add(sim, Kind.sting, 600, 400, 32, 12);
    const shot = add(sim, Kind.projectile, 605, 404, 10, 3);
    const low = add(sim, Kind.sting, 600, WORLD.height + 1, 32, 12);
    const high = add(sim, Kind.sting, 600, -13, 32, 12);
    const gone = add(sim, Kind.sting, -33, 300, 32, 12);

    sim.step(IDLE);

    expect([sting, shot].map((id) => world.isAlive(id))).toEqual([true, true]);
    expect([low, high, gone].map((id) => world.isAlive(id))).toEqual([false, false, false]);
  });
});

describe("the hero's shots on the queen", () => {
  it('take her health one hit at a time', () => {
    const sim = setup({ shielded: true });
    runUntil(sim, inPhase('attacking'));
    const hit = listen(sim, 'bossHit');
    const shot = shotIntoQueen(sim);

    sim.step(IDLE);

    expect(sim.state.world.health[queen(sim)]).toBe(8);
    expect(sim.state.world.isAlive(shot)).toBe(false);
    expect(hit.mock.calls).toEqual([[{ healthLeft: 8 }]]);
  });

  it('enrage her at a third of her health, once for the whole fight', () => {
    const sim = setup({ shielded: true });
    runUntil(sim, inPhase('attacking'));
    const enraged = listen(sim, 'bossEnraged');
    sim.state.world.health[queen(sim)] = 4;
    shotIntoQueen(sim);

    sim.step(IDLE);
    expect(sim.state.boss.phase).toBe('attacking');
    sim.step(IDLE);
    expect(sim.state.boss.phase).toBe('enraged');

    // A charge later she is enraged again, without a second announcement.
    runUntil(sim, (state) => state.boss.phase === 'enraged' && state.boss.phaseTicks === 0);
    expect(enraged.mock.calls).toEqual([[{ healthLeft: 3 }]]);
  });
});

describe('her charge', () => {
  it('shakes in place, charges at her height, strikes the hero once and flies back to her post', () => {
    const sim = setup({ health: 30, shielded: true });
    runUntil(sim, inPhase('attacking'));
    const { world, player } = sim.state;
    world.health[queen(sim)] = 10;
    runUntil(sim, inPhase('windup'));
    expect(sim.state.boss.phaseTicks).toBe(0);
    const id = queen(sim);
    const at = [world.x[id], world.y[id]];

    // Clear her stings and her brood, and stand the hero in her way, unshielded.
    for (const other of [...ofKind(sim.state, Kind.sting), ...ofKind(sim.state, Kind.enemy)]) {
      world.kill(other);
    }
    sim.state.shieldTicks = 0;
    world.y[player] = (world.y[id] as number) + 40;
    const hit = listen(sim, 'playerHit');

    run(sim, BOSS.charge.windupTicks - 1);
    expect(sim.state.boss.phase).toBe('windup');
    expect([world.x[id], world.y[id]]).toEqual(at);
    sim.step(IDLE);
    expect(sim.state.boss.phase).toBe('charging');
    expect(world.vx[id]).toBe(-BOSS.charge.speed);

    runUntil(sim, inPhase('returning'));
    expect(hit.mock.calls).toEqual([[{ livesLeft: 4 }]]);
    expect(world.prevX[id]).toBe(WORLD.width);

    runUntil(sim, inPhase('enraged'));
    expect(world.x[id]).toBe(BOSS.postX);
  });
});

describe('her defeat', () => {
  it('clears her stings and her brood, scores her health, and lets her fall among explosions', () => {
    const sim = setup({ shielded: true });
    runUntil(sim, inPhase('attacking'));
    const { world } = sim.state;
    const sting = add(sim, Kind.sting, 600, 400, 32, 12);
    const brood = add(sim, Kind.enemy, 700, 200, 100, 100);
    world.health[brood] = 3;
    world.value[brood] = 3;
    const id = queen(sim);
    world.health[id] = 0;
    const defeated = listen(sim, 'bossDefeated');
    const explosions = listen(sim, 'explosion');
    const score = sim.state.score;

    sim.step(IDLE);

    expect(sim.state.boss.phase).toBe('defeated');
    expect([world.isAlive(sting), world.isAlive(brood)]).toEqual([false, false]);
    expect(sim.state.score).toBe(score + 9);
    expect(defeated.mock.calls).toEqual([
      [
        {
          x: BOSS.postX + BOSS.hitbox.width / 2,
          y: (world.prevY[id] as number) + BOSS.hitbox.height / 2,
          value: 9,
        },
      ],
    ]);
    // The brood explodes with her and scores nothing.
    expect(explosions).toHaveBeenCalledTimes(1);
    expect([world.vx[id], world.vy[id]]).toEqual([0, BOSS.defeat.sinkSpeed]);

    run(sim, BOSS.defeat.ticks - 1);
    expect(sim.state.boss.phase).toBe('defeated');
    expect(explosions.mock.calls.length).toBeGreaterThan(4);
    sim.step(IDLE);
    expect(sim.state.boss).toMatchObject({ phase: 'beaten', id: undefined });
    expect(world.isAlive(id)).toBe(false);
  });

  it('takes no more shots once she is defeated', () => {
    const sim = setup({ shielded: true });
    runUntil(sim, inPhase('attacking'));
    sim.state.world.health[queen(sim)] = 0;
    sim.step(IDLE);
    const shot = shotIntoQueen(sim);

    sim.step(IDLE);

    expect(sim.state.world.isAlive(shot)).toBe(true);
  });

  it('wins the run on the last level, and clears any other for the next, without her', () => {
    const won = setup({ shielded: true });
    won.step(IDLE);
    won.state.world.health[queen(won)] = 0;
    runUntil(won, (state) => state.status !== 'playing');
    expect(won.state.status).toBe('won');

    const plain: LevelConfig = {
      breakTicks: 1,
      speedScale: 1,
      timeChangesAfter: false,
      waves: [{ count: 1, intervalTicks: 1 }],
    };
    const cleared = setup({ shielded: true, levels: [QUEEN_LEVEL, plain] });
    const levelCleared = listen(cleared, 'levelCleared');
    cleared.step(IDLE);
    cleared.state.world.health[queen(cleared)] = 0;
    runUntil(cleared, (state) => state.status === 'levelCleared');
    expect(levelCleared.mock.calls).toEqual([[{ level: 1, score: 9 }]]);

    cleared.step(IDLE);
    expect(cleared.state.level).toBe(2);
    expect(cleared.state.boss).toEqual({
      phase: 'absent',
      id: undefined,
      phaseTicks: 0,
      targetY: 0,
      struck: false,
    });
  });
});

describe('the queen in the hash of a run', () => {
  it('counts while she is in the world', () => {
    const a = setup({ shielded: true });
    const b = setup({ shielded: true });
    runUntil(a, inPhase('attacking'));
    runUntil(b, inPhase('attacking'));
    expect(hashGameState(a.state)).toBe(hashGameState(b.state));

    b.state.boss.targetY += 1;

    expect(hashGameState(a.state)).not.toBe(hashGameState(b.state));
  });
});
