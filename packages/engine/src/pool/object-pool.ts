/**
 * Fixed-capacity object pool. Projectiles, explosions and particles are created once, up front,
 * and handed out and taken back during play, so a tick allocates nothing and the garbage collector
 * has nothing to pause the game for (CLAUDE.md, "Hot loop").
 *
 * The active items occupy the indices `[0, active)` of `at`, in acquisition order, until a release
 * moves the last active item into the freed slot. Iterating backwards is therefore the safe way to
 * release items while walking the pool.
 */

export interface PoolOptions<T extends object> {
  /** Items created at construction; `acquire` returns `undefined` beyond it. */
  readonly capacity: number;
  /** Builds item number `index` (0-based) at construction time. */
  readonly create: (index: number) => T;
  /** Returns a released item to a clean state. Runs at release time. */
  readonly reset?: (item: T) => void;
}

export interface Pool<T extends object> {
  readonly capacity: number;
  /** Items currently acquired; they are the indices `[0, active)` of `at`. */
  readonly active: number;
  /** Items that `acquire` can still hand out. */
  readonly available: number;
  /** Takes a free item, or `undefined` when the pool is exhausted and the caller must skip. */
  acquire(): T | undefined;
  /**
   * Returns an item. The last active item moves into the freed slot.
   *
   * @throws Error when the item does not belong to this pool or is not acquired.
   */
  release(item: T): void;
  /**
   * The active item at `index`.
   *
   * @throws RangeError when `index` is outside `[0, active)`.
   */
  at(index: number): T;
  /** Releases every active item, running `reset` on each. */
  releaseAll(): void;
}

export function createPool<T extends object>(options: PoolOptions<T>): Pool<T> {
  const { capacity, create, reset } = options;
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new RangeError(`createPool: capacity must be an integer >= 1, got ${String(capacity)}`);
  }

  const items: T[] = [];
  // Position of each item inside `items`, kept current across swaps, so `release` is O(1).
  const positions = new Map<T, number>();
  for (let index = 0; index < capacity; index += 1) {
    const item = create(index);
    if (positions.has(item)) {
      throw new Error(`createPool: create returned the same item twice (index ${String(index)})`);
    }
    items.push(item);
    positions.set(item, index);
  }
  let active = 0;

  // `items` always holds exactly `capacity` entries, so an index below `capacity` is in bounds.
  const itemAt = (index: number): T => items[index] as T;

  return {
    capacity,
    get active() {
      return active;
    },
    get available() {
      return capacity - active;
    },
    acquire(): T | undefined {
      if (active === capacity) {
        return undefined;
      }
      const item = itemAt(active);
      active += 1;
      return item;
    },
    release(item: T): void {
      const index = positions.get(item);
      if (index === undefined) {
        throw new Error('release: the item does not belong to this pool');
      }
      if (index >= active) {
        throw new Error('release: the item is not acquired');
      }
      reset?.(item);
      active -= 1;
      const last = itemAt(active);
      items[index] = last;
      items[active] = item;
      positions.set(last, index);
      positions.set(item, active);
    },
    at(index: number): T {
      if (!Number.isInteger(index) || index < 0 || index >= active) {
        throw new RangeError(`at: index must be in [0, ${String(active)}), got ${String(index)}`);
      }
      return itemAt(index);
    },
    releaseAll(): void {
      if (reset !== undefined) {
        for (let index = 0; index < active; index += 1) {
          reset(itemAt(index));
        }
      }
      active = 0;
    },
  };
}
