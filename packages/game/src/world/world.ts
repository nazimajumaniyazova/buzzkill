/**
 * The entity store of the simulation (ADR-0003: a hand-written, minimal ECS-lite). An entity is
 * an integer id; every component field is a typed array indexed by that id, sized once from the
 * capacity, so spawning and moving allocate nothing. There are no archetypes and no queries:
 * systems walk the dense list of live ids and look at `kind`.
 *
 * Order matters for determinism (ADR-0009). Live ids are kept in a dense array in spawn order.
 * Systems never remove entities while iterating; they mark them dead, and `flushDead` removes
 * the marked ones at the end of the tick by swap-remove, walking backwards. The result depends
 * only on the sequence of operations, so the same inputs always give the same order.
 */

/** An entity id: an index into the component arrays. Branded so a count is not passed by mistake. */
export type EntityId = number & { readonly __brand: 'EntityId' };

/** What an entity is. A plain object of constants: enums are banned in the workspace. */
export const Kind = {
  player: 1,
  enemy: 2,
  projectile: 3,
  explosion: 4,
} as const;
export type Kind = (typeof Kind)[keyof typeof Kind];

export interface World {
  readonly capacity: number;
  /** Number of live entities; their ids are `dense[0 .. count)`. */
  readonly count: number;
  /** Live ids in iteration order. Entries at `count` and beyond are stale. */
  readonly dense: Int32Array;

  // Components, all indexed by entity id. A field means nothing for kinds that do not use it.
  readonly kind: Uint8Array;
  /** Top-left corner and size of the collision box, in world pixels. */
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly width: Float64Array;
  readonly height: Float64Array;
  /** Position at the start of the tick, for interpolated rendering. */
  readonly prevX: Float64Array;
  readonly prevY: Float64Array;
  /** Velocity in pixels per tick. */
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  /** Enemy: hits left. */
  readonly health: Int32Array;
  /** Enemy: score awarded when destroyed. */
  readonly value: Int32Array;
  /** Enemy: vertical wave, `y += amplitude * sin(angle)`, `angle += angleSpeed`. */
  readonly angle: Float64Array;
  readonly angleSpeed: Float64Array;
  readonly amplitude: Float64Array;
  /** Enemy: index into the mode's enemy set. Explosion: 0 smoke, 1 fire. */
  readonly variant: Uint8Array;
  /** Tick the entity was spawned in, for animations and lifetimes. */
  readonly bornTick: Int32Array;
  /** Marked for removal at the end of the tick. */
  readonly dead: Uint8Array;

  /**
   * Takes a free id, resets its components and appends it to the dense list. Returns `undefined`
   * when the world is full, and the caller skips the spawn.
   */
  spawn(kind: Kind, tick: number): EntityId | undefined;
  /** Sets the box of `id` and its previous position, so a new entity does not interpolate in. */
  place(id: EntityId, x: number, y: number, width: number, height: number): void;
  /** Marks an entity for removal; it stays in the dense list until `flushDead`. */
  kill(id: EntityId): void;
  isAlive(id: EntityId): boolean;
  /** Removes every marked entity and returns how many were removed. */
  flushDead(): number;
  /** Id at position `index` of the dense list. */
  at(index: number): EntityId;
}

export function createWorld(capacity: number): World {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new RangeError(`createWorld: capacity must be an integer >= 1, got ${String(capacity)}`);
  }

  const dense = new Int32Array(capacity);
  // Position of each live id in `dense`, so a removal is O(1).
  const position = new Int32Array(capacity).fill(-1);
  // Free ids as a stack. Filled in reverse so the first spawn gets id 0.
  const free = new Int32Array(capacity);
  for (let i = 0; i < capacity; i += 1) {
    free[i] = capacity - 1 - i;
  }
  let freeCount = capacity;
  let count = 0;
  let pendingDead = 0;

  const f64 = (): Float64Array => new Float64Array(capacity);
  const world = {
    capacity,
    dense,
    kind: new Uint8Array(capacity),
    x: f64(),
    y: f64(),
    width: f64(),
    height: f64(),
    prevX: f64(),
    prevY: f64(),
    vx: f64(),
    vy: f64(),
    health: new Int32Array(capacity),
    value: new Int32Array(capacity),
    angle: f64(),
    angleSpeed: f64(),
    amplitude: f64(),
    variant: new Uint8Array(capacity),
    bornTick: new Int32Array(capacity),
    dead: new Uint8Array(capacity),
  };

  const reset = (id: number): void => {
    world.x[id] = 0;
    world.y[id] = 0;
    world.width[id] = 0;
    world.height[id] = 0;
    world.prevX[id] = 0;
    world.prevY[id] = 0;
    world.vx[id] = 0;
    world.vy[id] = 0;
    world.health[id] = 0;
    world.value[id] = 0;
    world.angle[id] = 0;
    world.angleSpeed[id] = 0;
    world.amplitude[id] = 0;
    world.variant[id] = 0;
    world.dead[id] = 0;
  };

  const isLive = (id: number): boolean =>
    Number.isInteger(id) && id >= 0 && id < capacity && position[id] !== -1;

  return {
    ...world,
    get count() {
      return count;
    },
    spawn(kind, tick) {
      if (freeCount === 0) {
        return undefined;
      }
      freeCount -= 1;
      // `free` holds `freeCount + 1` valid entries before the decrement.
      const id = free[freeCount] as number;
      reset(id);
      world.kind[id] = kind;
      world.bornTick[id] = tick;
      dense[count] = id;
      position[id] = count;
      count += 1;
      return id as EntityId;
    },
    place(id, x, y, width, height) {
      world.x[id] = x;
      world.y[id] = y;
      world.prevX[id] = x;
      world.prevY[id] = y;
      world.width[id] = width;
      world.height[id] = height;
    },
    kill(id) {
      if (!isLive(id)) {
        throw new RangeError(`kill: ${String(id)} is not a live entity`);
      }
      if (world.dead[id] === 0) {
        world.dead[id] = 1;
        pendingDead += 1;
      }
    },
    isAlive(id) {
      return isLive(id) && world.dead[id] === 0;
    },
    flushDead() {
      if (pendingDead === 0) {
        return 0;
      }
      let removed = 0;
      for (let index = count - 1; index >= 0; index -= 1) {
        // Below `count`, every dense entry is a live id.
        const id = dense[index] as number;
        if (world.dead[id] === 0) {
          continue;
        }
        const last = dense[count - 1] as number;
        dense[index] = last;
        position[last] = index;
        position[id] = -1;
        world.kind[id] = 0;
        world.dead[id] = 0;
        count -= 1;
        free[freeCount] = id;
        freeCount += 1;
        removed += 1;
      }
      pendingDead = 0;
      return removed;
    },
    at(index) {
      if (!Number.isInteger(index) || index < 0 || index >= count) {
        throw new RangeError(`at: index must be in [0, ${String(count)}), got ${String(index)}`);
      }
      return dense[index] as EntityId;
    },
  };
}
