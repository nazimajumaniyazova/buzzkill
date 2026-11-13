import { createGridAtlas, type Renderer, type SpriteAtlas } from '@buzzkill/engine';
import { createSimulation, type EntityId, Kind, type Simulation } from '@buzzkill/game';
import { beforeEach, describe, expect, it } from 'vitest';

import { createGameDrawer } from './draw-game';
import type { GameSprites } from './sprites';

type Call = readonly unknown[];

function createFakeRenderer() {
  const calls: Call[] = [];
  const renderer: Renderer<string> = {
    width: 1280,
    height: 720,
    setScale: () => undefined,
    beginFrame: () => calls.push(['beginFrame']),
    drawSprite: (atlas: SpriteAtlas<string>, frame, x, y, options) =>
      calls.push(['sprite', atlas.image, frame, x, y, options]),
    fillRect: (x, y, width, height, color) => calls.push(['rect', x, y, width, height, color]),
    drawText: () => undefined,
    endFrame: () => {
      calls.push(['endFrame']);
      return { sprites: 0, culled: 0 };
    },
  };
  return { renderer, calls };
}

const atlas = (image: string, frames: number) =>
  createGridAtlas(image, { frameWidth: 10, frameHeight: 10, frames });

const animation = (image: string, frames: number, frameTicks: number) => ({
  atlas: atlas(image, frames),
  frameTicks,
});

const SPRITES: GameSprites<string> = {
  heroes: { male: animation('mike', 4, 4), female: animation('julie', 4, 4) },
  enemies: { wasp: animation('wasp', 6, 2) },
  projectile: atlas('shot-trail', 1),
  explosions: [atlas('smoke', 9), atlas('fire', 9)],
  powerUps: [
    animation('power-ammo', 4, 8),
    animation('power-life', 4, 8),
    animation('power-shield', 4, 8),
    animation('power-rapid-fire', 4, 8),
  ],
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
