import { fitContain, type Size } from '@buzzkill/engine';

/**
 * The smallest scale at which the world still plays well: half its size, 640 × 360 CSS pixels of
 * its 1280 × 720. Below it the enemies and their stings are a few pixels across.
 */
export const COMFORTABLE_SCALE = 0.5;

/** The scale at which the world fits a viewport, letterboxed as the canvas is. */
function scaleIn(world: Size, viewport: Size): number {
  return fitContain(world, viewport).width / world.width;
}

/**
 * Whether to suggest turning the screen sideways (#153): the world fits it below the comfortable
 * scale, and it would fit bigger if the screen were turned. A phone held upright shows the world
 * at a third of its size; sideways, at more than half.
 */
export function suggestsLandscape(world: Size, viewport: Size): boolean {
  const scale = scaleIn(world, viewport);
  const turned = scaleIn(world, { width: viewport.height, height: viewport.width });
  return scale < COMFORTABLE_SCALE && turned > scale;
}
