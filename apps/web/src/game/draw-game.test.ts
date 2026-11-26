import {
  type Camera,
  createEventBus,
  createGridAtlas,
  IDENTITY_CAMERA,
  type Renderer,
  type SpriteAtlas,
} from '@buzzkill/engine';
import {
  createSimulation,
  type EntityId,
  type GameEvents,
  Kind,
  QUEEN,
  type Simulation,
} from '@buzzkill/game';
import { tokens } from '@buzzkill/ui';
import { beforeEach, describe, expect, it } from 'vitest';

import { createGameDrawer } from './draw-game';
import { HIT_STOP_MS } from './hit-stop';
import { PARTICLE_BURSTS } from './particles';
import { FLASH, SQUASH, STRETCH } from './sprite-effects';
import type { GameSprites } from './sprites';

type Call = readonly unknown[];

function createFakeRenderer() {
  const calls: Call[] = [];
  /** The camera of each frame, copied: the drawer may hand out the same object every frame. */
  const cameras: Camera[] = [];
  const renderer: Renderer<string> = {
    width: 1280,
    height: 720,
    setScale: () => undefined,
    beginFrame: (camera) => {
      cameras.push({ ...(camera ?? IDENTITY_CAMERA) });
      calls.push(['beginFrame']);
    },
    drawSprite: (atlas: SpriteAtlas<string>, frame, x, y, options) =>
      calls.push(['sprite', atlas.image, frame, x, y, options]),
    fillRect: (x, y, width, height, color) => calls.push(['rect', x, y, width, height, color]),
    drawText: () => undefined,
    endFrame: () => {
      calls.push(['endFrame']);
      return { sprites: 0, culled: 0 };
    },
  };
  return { renderer, calls, cameras };
}

const atlas = (image: string, frames: number) =>
  createGridAtlas(image, { frameWidth: 10, frameHeight: 10, frames });

const animation = (image: string, frames: number, frameTicks: number) => ({
  atlas: atlas(image, frames),
  frameTicks,
});

const SPRITES: GameSprites<string> = {
  heroes: {
    male: animation('mike', 4, 4),
    female: animation('julie', 4, 4),
    sam: animation('sam', 4, 4),
    leo: animation('leo', 4, 4),
  },
  enemies: { wasp: animation('wasp', 6, 2) },
  projectile: atlas('shot-trail', 1),
  explosions: [atlas('smoke', 9), atlas('fire', 9)],
  powerUps: [
    animation('power-ammo', 4, 8),
    animation('power-life', 4, 8),
    animation('power-shield', 4, 8),
    animation('power-rapid-fire', 4, 8),
  ],
  boss: {
    queen: animation('queen', 4, 2),
    rage: animation('queen-rage', 4, 2),
    sting: atlas('sting', 1),
  },
  // No city here, so these tests see only the entities; the city has tests of its own below.
  backgrounds: { day: [], night: [] },
};

const WORLD = { width: 1280, height: 720 };

/** A day city of three layers, as the generated manifest gives them. */
const CITY: GameSprites<string> = {
  ...SPRITES,
  backgrounds: {
    day: [
      { layer: 'sky', atlas: atlas('day-sky', 1) },
      { layer: 'far', atlas: atlas('day-far', 1) },
      { layer: 'near', atlas: atlas('day-near', 1) },
    ],
    night: [],
  },
};

/** Removes the hero so a test sees only the entities it adds. */
function emptyWorld(sim: Simulation): void {
  sim.state.world.kill(sim.state.player);
  sim.state.world.flushDead();
}

type EntityKind = Parameters<Simulation['state']['world']['spawn']>[0];

function add(sim: Simulation, kind: EntityKind, x: number, y: number, size = 50): EntityId {
  const { world } = sim.state;
  const id = world.spawn(kind, sim.state.tick) as EntityId;
  world.place(id, x, y, size, size);
  return id;
}

describe('createGameDrawer', () => {
  let sim: Simulation;

  beforeEach(() => {
    sim = createSimulation({ seed: 1, heroId: 'female', mode: 'night' });
  });

  it('frames the scene: entities, then the end of the frame', () => {
    const { renderer, calls } = createFakeRenderer();

    createGameDrawer(renderer, SPRITES).render(sim.state, 0);

    expect(calls[0]).toEqual(['beginFrame']);
    expect(calls[1]).toEqual([
      'sprite',
      'julie',
      0,
      20,
      100,
      { width: sim.state.hero.width, height: sim.state.hero.height },
    ]);
    expect(calls.at(-1)).toEqual(['endFrame']);
  });

  it('animates the hero by tick', () => {
    const { renderer, calls } = createFakeRenderer();
    sim.state.tick += 9;

    createGameDrawer(renderer, SPRITES).render(sim.state, 0);

    // Four ticks per frame: tick 9 shows frame 2.
    expect(calls[1]?.slice(0, 3)).toEqual(['sprite', 'julie', 2]);
  });

  it('interpolates positions between the previous and the current tick', () => {
    const { renderer, calls } = createFakeRenderer();
    emptyWorld(sim);
    const id = add(sim, Kind.projectile, 100, 200);
    sim.state.world.x[id] = 110;
    sim.state.world.y[id] = 190;

    createGameDrawer(renderer, SPRITES).render(sim.state, 0.25);

    // The shot in flight: a 30 x 6 tail that ends in the head, which is the 10 x 3 hitbox.
    expect(calls[1]).toEqual(['sprite', 'shot-trail', 0, 82.5, 196, { width: 30, height: 6 }]);
  });

  it('animates enemies by tick from their spawn and draws their health bar', () => {
    const { renderer, calls } = createFakeRenderer();
    sim = createSimulation({ seed: 1, heroId: 'male', mode: 'day' });
    emptyWorld(sim);
    const id = add(sim, Kind.enemy, 300, 400);
    // Variant 1 is the second day enemy, the wasp: 6 frames of two ticks each.
    sim.state.world.variant[id] = 1;
    sim.state.world.health[id] = 1;
    sim.state.world.value[id] = 4;
    sim.state.tick += 15;

    createGameDrawer(renderer, SPRITES).render(sim.state, 0);

    expect(calls.slice(1, 4)).toEqual([
      ['sprite', 'wasp', 1, 300, 400, { width: 50, height: 50 }],
      ['rect', 300, 410, 50, 10, '#0009'],
      ['rect', 300, 410, 12.5, 10, '#48bf53'],
    ]);
  });

  it('draws explosions as smoke or fire by variant, frame by frame', () => {
    const { renderer, calls } = createFakeRenderer();
    emptyWorld(sim);
    add(sim, Kind.explosion, 0, 0, 200);
    const fire = add(sim, Kind.explosion, 300, 0, 200);
    sim.state.world.variant[fire] = 1;
    sim.state.tick += 9;

    createGameDrawer(renderer, SPRITES).render(sim.state, 0);

    // Four ticks per frame: tick 9 shows frame 2.
    expect(calls.slice(1, 3)).toEqual([
      ['sprite', 'smoke', 2, 0, 0, { width: 200, height: 200 }],
      ['sprite', 'fire', 2, 300, 0, { width: 200, height: 200 }],
    ]);
  });
});

describe('power-ups', () => {
  it('draw by kind, their halo pulsing from the tick they dropped', () => {
    const { renderer, calls } = createFakeRenderer();
    const sim = createSimulation({ seed: 1, heroId: 'male', mode: 'day' });
    emptyWorld(sim);
    const shield = add(sim, Kind.powerUp, 400, 300, 32);
    sim.state.world.variant[shield] = 2;
    sim.state.tick += 20;
    const rapid = add(sim, Kind.powerUp, 500, 300, 32);
    sim.state.world.variant[rapid] = 3;
    sim.state.tick += 9;

    createGameDrawer(renderer, SPRITES).render(sim.state, 0);

    // Eight ticks per frame: the shield is 29 ticks old, frame 3; rapid fire 9 ticks, frame 1.
    expect(calls.slice(1, 3)).toEqual([
      ['sprite', 'power-shield', 3, 400, 300, { width: 32, height: 32 }],
      ['sprite', 'power-rapid-fire', 1, 500, 300, { width: 32, height: 32 }],
    ]);
  });
});

describe('the queen', () => {
  const BOX = { width: QUEEN.hitbox.width, height: QUEEN.hitbox.height };
  const LANE = tokens.primitives.palette.red[400].value;

  /** The queen in `phase`, still at her post since tick 0, and the tick moved on by `ticks`. */
  function queenIn(phase: Simulation['state']['boss']['phase'], ticks: number) {
    const sim = createSimulation({ seed: 1, heroId: 'male', mode: 'day' });
    emptyWorld(sim);
    const { world } = sim.state;
    const id = world.spawn(Kind.boss, 0) as EntityId;
    world.place(id, 940, 200, BOX.width, BOX.height);
    Object.assign(sim.state.boss, { phase, id });
    sim.state.tick = ticks;
    return sim;
  }

  it('beats her wings from her arrival, and draws her stings in their boxes', () => {
    const { renderer, calls } = createFakeRenderer();
    const sim = queenIn('attacking', 5);
    const sting = add(sim, Kind.sting, 600, 330);
    sim.state.world.place(sting, 600, 330, 32, 12);

    createGameDrawer(renderer, SPRITES).render(sim.state, 0);

    // Two ticks a frame: five ticks after her arrival she shows frame 2.
    expect(calls.slice(1, 3)).toEqual([
      ['sprite', 'queen', 2, 940, 200, BOX],
      ['sprite', 'sting', 0, 600, 330, { width: 32, height: 12 }],
    ]);
  });

  it('lays her rage over the same frame, from her rage through her charges', () => {
    for (const phase of ['enraged', 'charging', 'returning'] as const) {
      const { renderer, calls } = createFakeRenderer();

      createGameDrawer(renderer, SPRITES).render(queenIn(phase, 7).state, 0);

      expect(calls.slice(1, 3)).toEqual([
        ['sprite', 'queen', 3, 940, 200, BOX],
        ['sprite', 'queen-rage', 3, 940, 200, BOX],
      ]);
    }
  });

  it('marks the path of her charge with red lines while she winds it up, and shakes her', () => {
    const { renderer, calls } = createFakeRenderer();
    const drawer = createGameDrawer(renderer, SPRITES);
    const xs = [0, 1, 2, 3].map((tick) => {
      calls.length = 0;
      drawer.render(queenIn('windup', tick).state, 0);
      return calls.find((call) => call[0] === 'sprite' && call[1] === 'queen')?.[3];
    });

    expect(calls.filter((call) => call[0] === 'rect')).toEqual([
      ['rect', 0, 200, 1280, 4, LANE],
      ['rect', 0, 200 + BOX.height - 4, 1280, 4, LANE],
    ]);
    expect(new Set(xs).size).toBe(2);
    expect(xs.every((x) => typeof x === 'number' && Math.abs(x - 940) <= 4)).toBe(true);
  });

  it('keeps the red lines but not the shaking under reduced motion', () => {
    const { renderer, calls } = createFakeRenderer();
    const drawer = createGameDrawer(renderer, SPRITES, { reducedMotion: () => true });
    const xs = [0, 1, 2, 3].map((tick) => {
      calls.length = 0;
      drawer.render(queenIn('windup', tick).state, 0);
      return calls.find((call) => call[0] === 'sprite' && call[1] === 'queen')?.[3];
    });

    expect(xs).toEqual([940, 940, 940, 940]);
    expect(calls.filter((call) => call[0] === 'rect')).toHaveLength(2);
  });
});

describe('the city behind the run', () => {
  let sim: Simulation;

  beforeEach(() => {
    sim = createSimulation({ seed: 1, heroId: 'male', mode: 'day' });
    emptyWorld(sim);
    sim.state.tick = 100;
  });

  it('keeps the sky still and tiles every other layer at its own pace, back to front', () => {
    const { renderer, calls } = createFakeRenderer();

    createGameDrawer(renderer, CITY).render(sim.state, 0.5);

    // 100.5 ticks in: the near layer moves a pixel a tick, the far one a quarter of that. Each
    // scrolling layer is drawn twice, so it tiles across the screen.
    expect(calls.slice(1, -1)).toEqual([
      ['sprite', 'day-sky', 0, 0, 0, WORLD],
      ['sprite', 'day-far', 0, -25.125, 0, WORLD],
      ['sprite', 'day-far', 0, 1254.875, 0, WORLD],
      ['sprite', 'day-near', 0, -100.5, 0, WORLD],
      ['sprite', 'day-near', 0, 1179.5, 0, WORLD],
    ]);
  });

  it('moves the city at a quarter of its pace under reduced motion', () => {
    const { renderer, calls } = createFakeRenderer();

    createGameDrawer(renderer, CITY, { reducedMotion: () => true }).render(sim.state, 0.5);

    expect(calls.slice(1, -1).map((call) => call.slice(1, 4))).toEqual([
      ['day-sky', 0, 0],
      ['day-far', 0, -6.281_25],
      ['day-far', 0, 1273.718_75],
      ['day-near', 0, -25.125],
      ['day-near', 0, 1254.875],
    ]);
  });

  it('reads the motion setting every frame, so a change applies to the run on screen', () => {
    const { renderer, calls } = createFakeRenderer();
    let reduced = false;
    const drawer = createGameDrawer(renderer, CITY, { reducedMotion: () => reduced });

    drawer.render(sim.state, 0);
    reduced = true;
    drawer.render(sim.state, 0);

    const near = calls.filter((call) => call[1] === 'day-near').map((call) => call[3]);
    expect(near).toEqual([-100, 1180, -25, 1255]);
  });
});

describe('the particles of the run', () => {
  let sim: Simulation;

  beforeEach(() => {
    sim = createSimulation({ seed: 1, heroId: 'female', mode: 'day' });
    emptyWorld(sim);
  });

  type Burst = keyof typeof PARTICLE_BURSTS;

  /**
   * What a call drew: a sprite's image, or which of `bursts` has a rectangle's color. Some bursts
   * share a color, so a test names the bursts it expects.
   */
  const drawn = (call: Call, bursts: readonly Burst[]): string => {
    if (call[0] === 'sprite') {
      return String(call[1]);
    }
    const color = String(call[5]);
    return bursts.find((burst) => PARTICLE_BURSTS[burst].colors.includes(color)) ?? color;
  };

  /** The kinds drawn in a frame, each run of the same kind once. */
  const order = (calls: readonly Call[], bursts: readonly Burst[]): string[] =>
    calls
      .slice(1, -1)
      .map((call) => drawn(call, bursts))
      .filter((kind, index, kinds) => kind !== kinds[index - 1]);

  it('follows the events of the run: dust behind the insects, debris in front of them', () => {
    const { renderer, calls } = createFakeRenderer();
    add(sim, Kind.explosion, 300, 0, 200);
    const events = createEventBus<GameEvents>();
    const drawer = createGameDrawer(renderer, CITY);
    drawer.listen?.(events);

    events.emit('enemyDestroyed', { x: 400, y: 100, value: 1 });
    events.emit('explosion', { x: 400, y: 100, variant: 0 });
    drawer.render(sim.state, 0);

    expect(order(calls, ['dust', 'debris'])).toEqual([
      'day-sky',
      'day-far',
      'day-near',
      'dust',
      'smoke',
      'debris',
    ]);
  });

  it('sheds a trail behind each shot for every tick since the last frame', () => {
    const { renderer, calls } = createFakeRenderer();
    add(sim, Kind.projectile, 100, 200, 10);
    const drawer = createGameDrawer(renderer, SPRITES);

    drawer.render(sim.state, 0);
    sim.state.tick += 2;
    drawer.render(sim.state, 0);
    calls.length = 0;
    drawer.render(sim.state, 0);

    // Half a speck a tick: one for the two ticks, at the middle of the shot's left edge.
    const specks = calls.filter((call) => call[0] === 'rect');
    expect(specks.map((call) => drawn(call, ['trail']))).toEqual(['trail']);
    // A rectangle's call: its name, then its position and size.
    const [, x, y, width, height] = specks[0] as readonly [string, number, number, number, number];
    expect([x + width / 2, y + height / 2]).toEqual([100, 205]);
  });

  it('draws no particles while they are off', () => {
    const { renderer, calls } = createFakeRenderer();
    add(sim, Kind.projectile, 100, 200, 10);
    const events = createEventBus<GameEvents>();
    const drawer = createGameDrawer(renderer, SPRITES, { particles: () => false });
    drawer.listen?.(events);

    // An insect of no world: the particles take the point of a hit and never read the insect.
    events.emit('enemyHit', { id: 3 as EntityId, healthLeft: 1, x: 400, y: 100 });
    drawer.render(sim.state, 0);
    sim.state.tick += 2;
    drawer.render(sim.state, 0);
    drawer.render(sim.state, 0);

    expect(calls.filter((call) => call[0] === 'rect')).toEqual([]);
  });
});

describe('the screen shake of the run', () => {
  let sim: Simulation;

  beforeEach(() => {
    sim = createSimulation({ seed: 1, heroId: 'female', mode: 'day' });
    emptyWorld(sim);
  });

  it('looks through a still camera until something shakes it', () => {
    const { renderer, cameras } = createFakeRenderer();
    const events = createEventBus<GameEvents>();
    const drawer = createGameDrawer(renderer, SPRITES);
    drawer.listen?.(events);

    drawer.render(sim.state, 0);
    events.emit('playerHit', { livesLeft: 2, cause: 'day-1' });
    drawer.render(sim.state, 0.5);

    expect(cameras[0]).toEqual(IDENTITY_CAMERA);
    expect(cameras[1]).not.toEqual(IDENTITY_CAMERA);
  });

  it('keeps the camera still while the shake is off or motion is reduced', () => {
    for (const options of [{ screenShake: () => false }, { reducedMotion: () => true }]) {
      const { renderer, cameras } = createFakeRenderer();
      const events = createEventBus<GameEvents>();
      const drawer = createGameDrawer(renderer, SPRITES, options);
      drawer.listen?.(events);

      events.emit('bossDefeated', { x: 640, y: 360, value: 60 });
      drawer.render(sim.state, 0);

      expect(cameras).toEqual([IDENTITY_CAMERA]);
    }
  });
});

describe('the flash of a hit, and squash and stretch', () => {
  let sim: Simulation;

  beforeEach(() => {
    sim = createSimulation({ seed: 1, heroId: 'female', mode: 'day' });
  });

  /** A wasp of two lives that keeps still, alone in the world but for the hero. */
  function wasp(): EntityId {
    const id = add(sim, Kind.enemy, 300, 400);
    sim.state.world.variant[id] = 1;
    sim.state.world.health[id] = 1;
    sim.state.world.value[id] = 2;
    return id;
  }

  const spriteOf = (calls: readonly Call[], image: string): Call | undefined =>
    calls.find((call) => call[0] === 'sprite' && call[1] === image);

  it('flashes an insect that a shot hit, drawing its own sprite tinted white', () => {
    const { renderer, calls } = createFakeRenderer();
    const insect = wasp();
    const events = createEventBus<GameEvents>();
    const drawer = createGameDrawer(renderer, SPRITES);
    drawer.listen?.(events);

    events.emit('enemyHit', { id: insect, healthLeft: 1, x: 300, y: 420 });
    drawer.render(sim.state, 0);

    expect(spriteOf(calls, 'wasp')?.[5]).toEqual({
      width: 50,
      height: 50,
      tint: FLASH.color,
      tintAmount: FLASH.amount,
    });
    // The hero was not hit: drawn as it is.
    expect(spriteOf(calls, 'julie')?.[5]).not.toHaveProperty('tint');
  });

  it('squashes the hero about the middle of its base when it fires', () => {
    const { renderer, calls } = createFakeRenderer();
    const events = createEventBus<GameEvents>();
    const drawer = createGameDrawer(renderer, SPRITES);
    drawer.listen?.(events);
    const { width, height } = sim.state.hero;

    events.emit('shot', { x: 180, y: 120 });
    drawer.render(sim.state, 0);

    const wide = width * (1 + SQUASH.amount);
    const low = height * (1 - SQUASH.amount);
    const hero = spriteOf(calls, 'julie');
    expect(hero?.[3]).toBeCloseTo(20 + (width - wide) / 2);
    expect(hero?.[4]).toBeCloseTo(100 + (height - low));
    expect(hero?.[5]).toEqual({ width: wide, height: low });
  });

  it('stretches a bobbing insect upright about the middle of its base', () => {
    const { renderer, calls } = createFakeRenderer();
    const insect = wasp();
    // It rose a pixel in its last tick, and is drawn where it is now.
    sim.state.world.prevY[insect] = 401;

    createGameDrawer(renderer, SPRITES).render(sim.state, 1);

    const tall = 50 * (1 + STRETCH.perPixel);
    const narrow = 50 / (1 + STRETCH.perPixel);
    const drawn = spriteOf(calls, 'wasp');
    expect(drawn?.[3]).toBeCloseTo(300 + (50 - narrow) / 2);
    expect(drawn?.[4]).toBeCloseTo(400 + (50 - tall));
    // The matchers are typed `any`; as numbers, they keep the lint's checks on the object.
    expect(drawn?.[5]).toEqual({
      width: expect.closeTo(narrow, 9) as number,
      height: expect.closeTo(tall, 9) as number,
    });
  });

  it('neither flashes nor squashes nor stretches while they are off', () => {
    const { renderer, calls } = createFakeRenderer();
    const insect = wasp();
    sim.state.world.prevY[insect] = 401;
    const events = createEventBus<GameEvents>();
    const drawer = createGameDrawer(renderer, SPRITES, {
      hitFlash: () => false,
      squashStretch: () => false,
    });
    drawer.listen?.(events);

    events.emit('enemyHit', { id: insect, healthLeft: 1, x: 300, y: 420 });
    events.emit('shot', { x: 180, y: 120 });
    drawer.render(sim.state, 1);

    expect(spriteOf(calls, 'wasp')?.slice(3)).toEqual([300, 400, { width: 50, height: 50 }]);
    expect(spriteOf(calls, 'julie')?.slice(3)).toEqual([
      20,
      100,
      { width: sim.state.hero.width, height: sim.state.hero.height },
    ]);
  });
});

describe('hit-stop', () => {
  let sim: Simulation;

  beforeEach(() => {
    sim = createSimulation({ seed: 1, heroId: 'female', mode: 'day' });
  });

  /** Renders three frames around a hit on the hero: the hit, 30 ms later, and when it ends. */
  function hitAndHold(options: Parameters<typeof createGameDrawer>[2]): number {
    let now = 0;
    const { renderer, calls } = createFakeRenderer();
    const events = createEventBus<GameEvents>();
    const drawer = createGameDrawer(renderer, SPRITES, { ...options, now: () => now });
    drawer.listen?.(events);

    events.emit('playerHit', { livesLeft: 2, cause: 'day-1' });
    drawer.render(sim.state, 0);
    now = 30;
    sim.state.tick += 2;
    drawer.render(sim.state, 0);
    now = HIT_STOP_MS.playerHit;
    drawer.render(sim.state, 0);

    return calls.filter((call) => call[0] === 'beginFrame').length;
  }

  it('draws the frame of a hit on the hero, then leaves it on the canvas while the ticks go on', () => {
    // The frame between draws nothing, not even a clear: the canvas keeps the picture.
    expect(hitAndHold({})).toBe(2);
  });

  it('never holds while it is off or while motion is reduced', () => {
    expect(hitAndHold({ hitStop: () => false })).toBe(3);
    expect(hitAndHold({ reducedMotion: () => true })).toBe(3);
  });
});
