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

const SPRITES: GameSprites<string> = {
  enemies: { 'enemy-2': atlas('enemy-2', 13) },
  projectile: atlas('projectile', 1),
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
    // The heroes' art is not in the repository yet: a box in the hero's color.
    expect(calls[2]).toEqual([
      'rect',
      20,
      100,
      sim.state.hero.width,
      sim.state.hero.height,
      '#e07aa5',
    ]);
    expect(calls.at(-1)).toEqual(['endFrame']);
  });

  it('interpolates positions between the previous and the current tick', () => {
    const { renderer, calls } = createFakeRenderer();
    emptyWorld(sim);
    const id = add(sim, Kind.projectile, 100, 200);
    sim.state.world.x[id] = 110;
    sim.state.world.y[id] = 190;

    createGameDrawer(renderer, SPRITES).render(sim.state, 0.25);

    expect(calls[2]).toEqual(['sprite', 'projectile', 0, 102.5, 197.5, { width: 50, height: 50 }]);
  });

  it('animates enemies by tick from their spawn and draws their health bar', () => {
    const { renderer, calls } = createFakeRenderer();
    sim = createSimulation({ seed: 1, heroId: 'male', mode: 'day' });
    emptyWorld(sim);
    const id = add(sim, Kind.enemy, 300, 400);
    // Variant 1 is the second day enemy, sheet `enemy-2`: 13 frames of one tick each.
    sim.state.world.variant[id] = 1;
    sim.state.world.health[id] = 1;
    sim.state.world.value[id] = 4;
    sim.state.tick += 15;

    createGameDrawer(renderer, SPRITES).render(sim.state, 0);

    expect(calls.slice(2, 5)).toEqual([
      ['sprite', 'enemy-2', 2, 300, 400, { width: 50, height: 50 }],
      ['rect', 300, 410, 50, 10, 'rgb(0 0 0 / 60%)'],
      ['rect', 300, 410, 12.5, 10, '#48bf53'],
    ]);
  });

  it('draws enemies without art as boxes', () => {
    const { renderer, calls } = createFakeRenderer();
    sim = createSimulation({ seed: 1, heroId: 'male', mode: 'day' });
    emptyWorld(sim);
    // Variant 0 is `enemy-day-1`, whose art is missing.
    add(sim, Kind.enemy, 300, 400);

    createGameDrawer(renderer, SPRITES).render(sim.state, 0);

    expect(calls[2]).toEqual(['rect', 300, 400, 50, 50, '#c0392b']);
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
