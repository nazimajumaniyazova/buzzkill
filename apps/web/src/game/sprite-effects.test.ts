// @vitest-environment node
import { createEventBus } from '@buzzkill/engine';
import {
  createSimulation,
  type EntityId,
  type GameEvents,
  Kind,
  type Simulation,
} from '@buzzkill/game';
import { beforeEach, describe, expect, it } from 'vitest';

import { createSpriteEffects, FLASH, type SpriteEffects, SQUASH, STRETCH } from './sprite-effects';

describe('createSpriteEffects', () => {
  let sim: Simulation;
  let events: ReturnType<typeof createEventBus<GameEvents>>;
  let flashes: boolean;
  let squash: boolean;
  let reduced: boolean;
  let effects: SpriteEffects;

  beforeEach(() => {
    sim = createSimulation({ seed: 1, heroId: 'male', mode: 'day' });
    events = createEventBus<GameEvents>();
    flashes = true;
    squash = true;
    reduced = false;
    effects = createSpriteEffects({
      hitFlash: () => flashes,
      squashStretch: () => squash,
      reducedMotion: () => reduced,
    });
    effects.listen(events);
  });

  /** Puts an entity of `kind` into the world. */
  function add(kind: Parameters<Simulation['state']['world']['spawn']>[0]): EntityId {
    const { world, tick } = sim.state;
    const id = world.spawn(kind, tick) as EntityId;
    world.place(id, 300, 200, 50, 50);
    return id;
  }

  /** Starts a frame at `tick`. */
  function frame(tick: number): void {
    sim.state.tick = tick;
    effects.begin(sim.state);
  }

  const hit = (id: EntityId): void => {
    events.emit('enemyHit', { id, healthLeft: 1, x: 300, y: 220 });
  };

  it('flashes an insect that a shot hit, fading over its ticks', () => {
    const insect = add(Kind.enemy);
    hit(insect);
    frame(100);

    expect(effects.flash(sim.state, insect, 100)).toBe(FLASH.amount);
    expect(effects.flash(sim.state, insect, 100 + FLASH.ticks / 2)).toBeCloseTo(FLASH.amount / 2);
    expect(effects.flash(sim.state, insect, 100 + FLASH.ticks)).toBe(0);
    expect(effects.flash(sim.state, add(Kind.enemy), 100)).toBe(0);
  });

  it('flashes the hero when hit, and the queen when a shot strikes her', () => {
    const queen = add(Kind.boss);
    events.emit('playerHit', { livesLeft: 2 });
    events.emit('bossHit', { healthLeft: 10, x: 900, y: 300 });
    frame(50);

    expect(effects.flash(sim.state, sim.state.player, 50)).toBe(FLASH.amount);
    expect(effects.flash(sim.state, queen, 50)).toBe(FLASH.amount);
  });

  it('does not flash an insect that took the place of the one hit', () => {
    const insect = add(Kind.enemy);
    hit(insect);
    frame(100);

    // A new insect under the same id is born later.
    sim.state.world.bornTick[insect] = 101;

    expect(effects.flash(sim.state, insect, 101)).toBe(0);
  });

  it('starts flashes at most three times a second, hits of the same moment together', () => {
    const first = add(Kind.enemy);
    const second = add(Kind.enemy);
    hit(first);
    hit(second);
    frame(0);
    expect(effects.flash(sim.state, first, 0)).toBe(FLASH.amount);
    expect(effects.flash(sim.state, second, 0)).toBe(FLASH.amount);
    hit(first);
    frame(FLASH.gapTicks - 1);
    expect(effects.flash(sim.state, first, FLASH.gapTicks - 1)).toBe(0);

    // A hit every tick for ten seconds.
    const starts: number[] = [];
    for (let tick = FLASH.gapTicks; tick < FLASH.gapTicks + 600; tick += 1) {
      hit(first);
      frame(tick);
      if (effects.flash(sim.state, first, tick) === FLASH.amount) {
        starts.push(tick);
      }
    }
    for (const start of starts) {
      const inASecond = starts.filter((tick) => tick >= start && tick < start + 60);
      expect(inASecond.length).toBeLessThanOrEqual(3);
    }
    expect(starts.length).toBeGreaterThanOrEqual(29);
  });

  it('flashes softer while motion is reduced', () => {
    reduced = true;
    events.emit('playerHit', { livesLeft: 2 });
    frame(10);

    expect(effects.flash(sim.state, sim.state.player, 10)).toBe(FLASH.reducedAmount);
    expect(FLASH.reducedAmount).toBeLessThan(FLASH.amount);
  });

  it('does not flash while flashes are off, and drops those started when turned off', () => {
    const insect = add(Kind.enemy);
    hit(insect);
    frame(10);
    flashes = false;
    frame(11);
    expect(effects.flash(sim.state, insect, 11)).toBe(0);

    events.emit('playerHit', { livesLeft: 2 });
    frame(12);
    flashes = true;
    frame(13);
    expect(effects.flash(sim.state, sim.state.player, 13)).toBe(0);
  });

  it('squashes the hero when it fires, and brings it back over a few ticks', () => {
    events.emit('shot', { x: 180, y: 120 });
    frame(30);

    expect(effects.heroScale(30)).toEqual({ x: 1 + SQUASH.amount, y: 1 - SQUASH.amount });
    const half = effects.heroScale(30 + SQUASH.ticks / 2);
    expect(half.x).toBeCloseTo(1 + SQUASH.amount / 2);
    expect(half.y).toBeCloseTo(1 - SQUASH.amount / 2);
    expect(effects.heroScale(30 + SQUASH.ticks)).toEqual({ x: 1, y: 1 });
  });

  it('stretches an insect by how fast it bobs, up to a limit, keeping its area', () => {
    expect(effects.enemyScale(0)).toEqual({ x: 1, y: 1 });
    const bobbing = { ...effects.enemyScale(1) };
    expect(bobbing.y).toBeCloseTo(1 + STRETCH.perPixel);
    expect(bobbing.x * bobbing.y).toBeCloseTo(1);
    expect(effects.enemyScale(-20).y).toBeCloseTo(1 + STRETCH.max);
  });

  it('neither squashes nor stretches while off or while motion is reduced', () => {
    for (const [on, motion] of [
      [false, false],
      [true, true],
    ] as const) {
      squash = on;
      reduced = motion;
      events.emit('shot', { x: 180, y: 120 });
      frame(40);

      expect(effects.heroScale(40)).toEqual({ x: 1, y: 1 });
      expect(effects.enemyScale(2)).toEqual({ x: 1, y: 1 });
    }
  });
});
