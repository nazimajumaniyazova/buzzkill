/**
 * The art of Buzzkill (ADR-0015): every sprite and background as a pure function to SVG, drawn for
 * the game in the frame sizes of its configuration. The pipeline of #133 turns these documents into
 * the atlases the game loads; nothing here touches the DOM.
 */
import { queen, queenRage, sting } from './boss';
import { CITY_LAYERS, type CityLayer, cityLayer, type TimeOfDay, WORLD_SIZE } from './city';
import { explosion, shot, shotTrail } from './effects';
import { hero } from './heroes';
import { beetle, dragonfly, firefly, mosquito, moth, wasp } from './insects';
import { powerUp, type PowerUpKind } from './power-ups';

export { CITY_LAYERS, type CityLayer, type PowerUpKind, type TimeOfDay, WORLD_SIZE };

/** A sprite: its frame size, its frames and how to draw one. */
export interface SpriteArt {
  /** The frame in pixels: twice the world's, the size the game's configuration gives the frame. */
  readonly width: number;
  readonly height: number;
  readonly frames: number;
  /** Ticks each frame stays on screen at 60 ticks a second: the pace the art was drawn for. */
  readonly frameTicks: number;
  /** The inside of the frame's SVG; `id` prefixes every id it defines. */
  readonly draw: (frame: number, id: string) => string;
}

/** Every sprite of the game. Enemies keep the frame sizes, and so the hitboxes, of the 2023 art. */
export const SPRITES = {
  beetle: { width: 273, height: 273, frames: 6, frameTicks: 3, draw: (f, id) => beetle(f, 6, id) },
  wasp: { width: 253, height: 207, frames: 6, frameTicks: 2, draw: (f, id) => wasp(f, 6, id) },
  dragonfly: {
    width: 266,
    height: 207,
    frames: 4,
    frameTicks: 1,
    draw: (f, id) => dragonfly(f, 4, id),
  },
  moth: { width: 266, height: 188, frames: 8, frameTicks: 3, draw: (f, id) => moth(f, 8, id) },
  firefly: {
    width: 271,
    height: 194,
    frames: 6,
    frameTicks: 2,
    draw: (f, id) => firefly(f, 6, id),
  },
  mosquito: {
    width: 238,
    height: 167,
    frames: 4,
    frameTicks: 1,
    draw: (f, id) => mosquito(f, 4, id),
  },
  mike: { width: 321, height: 316, frames: 4, frameTicks: 4, draw: (f, id) => hero('mike', f, id) },
  julie: {
    width: 275,
    height: 297,
    frames: 4,
    frameTicks: 4,
    draw: (f, id) => hero('julie', f, id),
  },
  'explosion-fire': {
    width: 400,
    height: 400,
    frames: 9,
    frameTicks: 4,
    draw: (f) => explosion('fire', f),
  },
  'explosion-smoke': {
    width: 400,
    height: 400,
    frames: 9,
    frameTicks: 4,
    draw: (f) => explosion('smoke', f),
  },
  shot: { width: 20, height: 6, frames: 1, frameTicks: 1, draw: () => shot() },
  'shot-trail': {
    width: 60,
    height: 12,
    frames: 1,
    frameTicks: 1,
    draw: (_f, id) => shotTrail(id),
  },
  // The power-ups of #151, twice their 32×32 box: a crate, a heart, a hexagon and a diamond.
  'power-ammo': {
    width: 64,
    height: 64,
    frames: 4,
    frameTicks: 8,
    draw: (f) => powerUp('ammo', f),
  },
  'power-life': {
    width: 64,
    height: 64,
    frames: 4,
    frameTicks: 8,
    draw: (f) => powerUp('life', f),
  },
  'power-shield': {
    width: 64,
    height: 64,
    frames: 4,
    frameTicks: 8,
    draw: (f) => powerUp('shield', f),
  },
  'power-rapid-fire': {
    width: 64,
    height: 64,
    frames: 4,
    frameTicks: 8,
    draw: (f) => powerUp('rapidFire', f),
  },
  // The boss of #152, twice her 300×250 box; her rage is drawn over her frame of the same number.
  queen: { width: 600, height: 500, frames: 4, frameTicks: 2, draw: (f, id) => queen(f, 4, id) },
  'queen-rage': {
    width: 600,
    height: 500,
    frames: 4,
    frameTicks: 2,
    draw: (f, id) => queenRage(f, 4, id),
  },
  sting: { width: 64, height: 24, frames: 1, frameTicks: 1, draw: () => sting() },
} as const satisfies Record<string, SpriteArt>;

export type SpriteName = keyof typeof SPRITES;

const svg = (width: number, height: number, inner: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(width)} ${String(height)}" width="${String(width)}" height="${String(height)}">${inner}</svg>`;

/** One frame of a sprite as a standalone SVG document; its ids are unique across the whole art. */
export function frameSvg(name: SpriteName, frame: number): string {
  const sprite: SpriteArt = SPRITES[name];
  if (!Number.isInteger(frame) || frame < 0 || frame >= sprite.frames) {
    throw new RangeError(
      `frameSvg: ${name} has frames 0 to ${String(sprite.frames - 1)}, got ${String(frame)}`,
    );
  }
  return svg(sprite.width, sprite.height, sprite.draw(frame, `${name}-${String(frame)}`));
}

/** One layer of the city as a standalone SVG document in world pixels. */
export function cityLayerSvg(time: TimeOfDay, layer: CityLayer): string {
  return svg(WORLD_SIZE.width, WORLD_SIZE.height, cityLayer(time, layer, `city-${time}-${layer}`));
}
