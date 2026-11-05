// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import { createWorld, type EntityId, Kind } from './world';

function liveIds(world: ReturnType<typeof createWorld>): number[] {
  return Array.from({ length: world.count }, (_, index) => world.at(index));
}

describe('createWorld', () => {
  it('hands out ids from 0 in spawn order and records kind and spawn tick', () => {
    const world = createWorld(4);

    const a = world.spawn(Kind.player, 0);
    const b = world.spawn(Kind.enemy, 7);

    expect([a, b]).toEqual([0, 1]);
    expect(liveIds(world)).toEqual([0, 1]);
    expect(world.kind[1]).toBe(Kind.enemy);
    expect(world.bornTick[1]).toBe(7);
  });

  it('returns undefined when full instead of growing', () => {
    const world = createWorld(2);
    world.spawn(Kind.enemy, 0);
    world.spawn(Kind.enemy, 0);

    expect(world.spawn(Kind.enemy, 0)).toBeUndefined();
    expect(world.count).toBe(2);
  });

  it('keeps killed entities until flushDead, then swap-removes them', () => {
    const world = createWorld(5);
    for (let i = 0; i < 5; i += 1) {
      world.spawn(Kind.enemy, 0);
    }

    world.kill(1 as EntityId);
    world.kill(3 as EntityId);
    expect(world.count).toBe(5);
    expect(world.isAlive(1 as EntityId)).toBe(false);

    expect(world.flushDead()).toBe(2);
    expect(liveIds(world)).toEqual([0, 4, 2]);
    expect(world.kind[1]).toBe(0);
  });

  it('reuses freed ids with clean components', () => {
    const world = createWorld(2);
    const id = world.spawn(Kind.enemy, 0) as EntityId;
    world.place(id, 10, 20, 30, 40);
    world.health[id] = 3;
    world.kill(id);
    world.flushDead();

    const again = world.spawn(Kind.projectile, 5) as EntityId;

    expect(again).toBe(id);
    expect([world.x[again], world.width[again], world.health[again]]).toEqual([0, 0, 0]);
    expect(world.kind[again]).toBe(Kind.projectile);
  });

  it('places an entity with its previous position equal to the new one', () => {
    const world = createWorld(1);
    const id = world.spawn(Kind.enemy, 0) as EntityId;

    world.place(id, 1, 2, 3, 4);

    expect([world.x[id], world.y[id], world.prevX[id], world.prevY[id]]).toEqual([1, 2, 1, 2]);
    expect([world.width[id], world.height[id]]).toEqual([3, 4]);
  });

  it('treats a second kill in the same tick as one removal', () => {
    const world = createWorld(2);
    const id = world.spawn(Kind.enemy, 0) as EntityId;

    world.kill(id);
    world.kill(id);

    expect(world.flushDead()).toBe(1);
    expect(world.flushDead()).toBe(0);
  });

  it('rejects bad capacities, killing a free id and out-of-range positions', () => {
    expect(() => createWorld(0)).toThrow(RangeError);
    const world = createWorld(2);
    expect(() => {
      world.kill(0 as EntityId);
    }).toThrow(RangeError);
    expect(() => world.at(0)).toThrow(RangeError);
    expect(world.isAlive(5 as EntityId)).toBe(false);
  });

  test.prop([fc.array(fc.oneof(fc.constant(-1), fc.nat({ max: 15 })), { maxLength: 200 })])(
    'never loses, duplicates or leaks an id, and is deterministic',
    (operations) => {
      const run = () => {
        const world = createWorld(8);
        for (const operation of operations) {
          if (operation === -1) {
            world.spawn(Kind.enemy, 0);
          } else if (operation < world.count) {
            world.kill(world.at(operation));
          } else {
            world.flushDead();
          }
          const ids = liveIds(world);
          expect(new Set(ids).size).toBe(ids.length);
          expect(ids.every((id) => id >= 0 && id < 8)).toBe(true);
        }
        world.flushDead();
        return liveIds(world);
      };

      expect(run()).toEqual(run());
    },
  );
});
