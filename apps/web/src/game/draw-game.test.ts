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

  it('frames the scene: sky of the mode, entities, end of frame', () => {
    const { renderer, calls } = createFakeRenderer();

    createGameDrawer(renderer, SPRITES).render(sim.state, 0);

    expect(calls[0]).toEqual(['beginFrame']);
    expect(calls[1]).toEqual(['rect', 0, 0, 1280, 720, '#121a2b']);
    expect(calls[2]).toEqual([
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
    expect(calls[2]?.slice(0, 3)).toEqual(['sprite', 'julie', 2]);
  });

  it('interpolates positions between the previous and the current tick', () => {
    const { renderer, calls } = createFakeRenderer();
    emptyWorld(sim);
    const id = add(sim, Kind.projectile, 100, 200);
    sim.state.world.x[id] = 110;
    sim.state.world.y[id] = 190;

    createGameDrawer(renderer, SPRITES).render(sim.state, 0.25);

    // The shot in flight: a 30 x 6 tail that ends in the head, which is the 10 x 3 hitbox.
    expect(calls[2]).toEqual(['sprite', 'shot-trail', 0, 82.5, 196, { width: 30, height: 6 }]);
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

    expect(calls.slice(2, 5)).toEqual([
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
    expect(calls.slice(2, 4)).toEqual([
      ['sprite', 'smoke', 2, 0, 0, { width: 200, height: 200 }],
      ['sprite', 'fire', 2, 300, 0, { width: 200, height: 200 }],
    ]);
  });
});
