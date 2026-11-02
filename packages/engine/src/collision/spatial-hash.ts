import { boxesOverlap } from './aabb';

/**
 * Broad-phase collision detection on a uniform grid. Every inserted box is registered in each
 * cell it touches; a query or a pair walk only compares boxes that share a cell, so the cost
 * follows the number of neighbors instead of the square of the entity count.
 *
 * Built for the hot loop: ids are small integers (ADR-0003 entity ids), boxes live in typed
 * arrays, cell lists are kept between frames and only truncated, and results are written into
 * arrays the caller owns. After the first frames no call allocates. Iteration order depends only
 * on the sequence of inserts, which keeps the simulation deterministic (ADR-0009).
 */

export interface SpatialHashOptions {
  /** Side of a square cell in world units. About the size of a typical entity works best. */
  readonly cellSize: number;
  /** Ids are integers in [0, capacity). The stores are sized once from it. */
  readonly capacity: number;
}

export interface SpatialHash {
  /** Boxes inserted since the last `clear`. */
  readonly size: number;
  /** Forgets every box. Call once per tick before re-inserting the moved entities. */
  clear(): void;
  /**
   * Registers the box of entity `id`.
   *
   * @throws RangeError for an id outside [0, capacity), a non-finite coordinate or a negative size.
   * @throws Error when the id was already inserted since the last `clear`.
   */
  insert(id: number, x: number, y: number, width: number, height: number): void;
  /**
   * Writes the ids of the inserted boxes that overlap the query box into `out`, starting at index
   * 0, and returns how many. Entries beyond the count are left as they were.
   */
  query(x: number, y: number, width: number, height: number, out: number[]): number;
  /**
   * Writes every overlapping pair exactly once into `out` as `[a0, b0, a1, b1, ...]` with
   * `a < b`, starting at index 0, and returns the number of pairs.
   */
  pairs(out: number[]): number;
}

interface Cell {
  readonly cx: number;
  readonly cy: number;
  readonly ids: number[];
}

// Cell coordinates are clamped to 16 bits so that a cell key is unique. Boxes further out than
// 32768 cells from the origin share the border cells: still correct, only slower there.
const CELL_MIN = -32_768;
const CELL_MAX = 32_767;

export function createSpatialHash(options: SpatialHashOptions): SpatialHash {
  const { cellSize, capacity } = options;
  if (!Number.isFinite(cellSize) || cellSize <= 0) {
    throw new RangeError(`createSpatialHash: cellSize must be positive, got ${String(cellSize)}`);
  }
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new RangeError(
      `createSpatialHash: capacity must be an integer >= 1, got ${String(capacity)}`,
    );
  }

  // x, y, width, height of every id, four slots per id.
  const boxes = new Float64Array(capacity * 4);
  // Generation in which an id was inserted; comparing against the current one avoids clearing.
  const insertedIn = new Uint32Array(capacity);
  // Query in which an id was last reported, so a box spanning several cells is reported once.
  const seenIn = new Uint32Array(capacity);
  const cells = new Map<number, Cell>();
  let generation = 1;
  let queryStamp = 0;
  let size = 0;

  const cellOf = (coordinate: number): number => {
    const cell = Math.floor(coordinate / cellSize);
    return cell < CELL_MIN ? CELL_MIN : cell > CELL_MAX ? CELL_MAX : cell;
  };

  const keyOf = (cx: number, cy: number): number => ((cx - CELL_MIN) << 16) | (cy - CELL_MIN);

  const assertBox = (x: number, y: number, width: number, height: number, what: string): void => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new RangeError(`${what}: coordinates must be finite, got ${String(x)}, ${String(y)}`);
    }
    if (!(width >= 0) || !(height >= 0) || !Number.isFinite(width) || !Number.isFinite(height)) {
      throw new RangeError(
        `${what}: sizes must be finite and >= 0, got ${String(width)}, ${String(height)}`,
      );
    }
  };

  return {
    get size() {
      return size;
    },

    clear(): void {
      for (const cell of cells.values()) {
        cell.ids.length = 0;
      }
      generation += 1;
      size = 0;
    },

    insert(id, x, y, width, height): void {
      if (!Number.isInteger(id) || id < 0 || id >= capacity) {
        throw new RangeError(
          `insert: id must be an integer in [0, ${String(capacity)}), got ${String(id)}`,
        );
      }
      assertBox(x, y, width, height, 'insert');
      if (insertedIn[id] === generation) {
        throw new Error(`insert: id ${String(id)} was already inserted since the last clear`);
      }
      insertedIn[id] = generation;
      const slot = id * 4;
      boxes[slot] = x;
      boxes[slot + 1] = y;
      boxes[slot + 2] = width;
      boxes[slot + 3] = height;
      size += 1;

      const x1 = cellOf(x + width);
      const y1 = cellOf(y + height);
      for (let cx = cellOf(x); cx <= x1; cx += 1) {
        for (let cy = cellOf(y); cy <= y1; cy += 1) {
          const key = keyOf(cx, cy);
          let cell = cells.get(key);
          if (cell === undefined) {
            cell = { cx, cy, ids: [] };
            cells.set(key, cell);
          }
          cell.ids.push(id);
        }
      }
    },

    query(x, y, width, height, out): number {
      assertBox(x, y, width, height, 'query');
      queryStamp += 1;
      let count = 0;
      const x1 = cellOf(x + width);
      const y1 = cellOf(y + height);
      for (let cx = cellOf(x); cx <= x1; cx += 1) {
        for (let cy = cellOf(y); cy <= y1; cy += 1) {
          const cell = cells.get(keyOf(cx, cy));
          if (cell === undefined) {
            continue;
          }
          for (const id of cell.ids) {
            if (seenIn[id] === queryStamp) {
              continue;
            }
            seenIn[id] = queryStamp;
            const slot = id * 4;
            if (
              boxesOverlap(
                x,
                y,
                width,
                height,
                boxes[slot] as number,
                boxes[slot + 1] as number,
                boxes[slot + 2] as number,
                boxes[slot + 3] as number,
              )
            ) {
              out[count] = id;
              count += 1;
            }
          }
        }
      }
      return count;
    },

    pairs(out): number {
      let count = 0;
      for (const cell of cells.values()) {
        const ids = cell.ids;
        for (let i = 0; i < ids.length; i += 1) {
          const a = ids[i] as number;
          const sa = a * 4;
          const ax = boxes[sa] as number;
          const ay = boxes[sa + 1] as number;
          const aw = boxes[sa + 2] as number;
          const ah = boxes[sa + 3] as number;
          for (let j = i + 1; j < ids.length; j += 1) {
            const b = ids[j] as number;
            const sb = b * 4;
            const bx = boxes[sb] as number;
            const by = boxes[sb + 1] as number;
            if (
              !boxesOverlap(
                ax,
                ay,
                aw,
                ah,
                bx,
                by,
                boxes[sb + 2] as number,
                boxes[sb + 3] as number,
              )
            ) {
              continue;
            }
            // Two boxes share every cell their intersection touches. Report the pair only from
            // the cell that holds the intersection's top-left corner, so it is counted once.
            if (cellOf(ax > bx ? ax : bx) !== cell.cx || cellOf(ay > by ? ay : by) !== cell.cy) {
              continue;
            }
            out[count * 2] = a < b ? a : b;
            out[count * 2 + 1] = a < b ? b : a;
            count += 1;
          }
        }
      }
      return count;
    },
  };
}
