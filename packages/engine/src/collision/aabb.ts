/**
 * Axis-aligned bounding boxes, the only collision shape of the game. A box is its top-left corner
 * plus a non-negative size, the same convention as the canvas API.
 */
export interface Aabb {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Strict overlap test on raw numbers, for hot loops that keep boxes in typed arrays. Boxes that
 * only touch along an edge do not overlap. A box with no area is a point: it overlaps a box it
 * lies strictly inside, but never a box edge and never itself.
 */
export function boxesOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
}

/** Strict overlap test for two boxes; see `boxesOverlap`. */
export function aabbOverlaps(a: Aabb, b: Aabb): boolean {
  return boxesOverlap(a.x, a.y, a.width, a.height, b.x, b.y, b.width, b.height);
}
