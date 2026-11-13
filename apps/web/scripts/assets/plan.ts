import { createHash } from 'node:crypto';

import {
  type CityLayer,
  cityLayerSvg,
  frameSvg,
  type SpriteName,
  SPRITES,
  type TimeOfDay,
  WORLD_SIZE,
} from '@buzzkill/art';
import type { GameSound } from '@buzzkill/game';

import { type PackedAtlas, packShelves } from './pack';

/**
 * Everything that shapes the output besides the inputs. It is part of every input hash, so a
 * changed setting marks the generated files as stale just like changed art.
 */
export const SETTINGS = {
  /** 2048 px is a texture size every device handles; padding keeps frames from bleeding. */
  atlas: { maxSize: 2048, padding: 2 },
  /**
   * Lossy WebP. Compared on crops at twice the size (2026-11-12): quality 80 looks the same as the
   * lossless master, 75 shows specks on the wasp's stripes; lossless is 1.8 times larger.
   */
  webp: { quality: 80, alphaQuality: 80, effort: 6 },
} as const;

/**
 * The sprites of each atlas. The game draws all of them during a run, so the split only keeps
 * each atlas within `SETTINGS.atlas.maxSize`. The art's `shot` sprite is not here: the game draws
 * the shot in flight, `shot-trail`.
 */
const ATLAS_SPRITES = {
  creatures: ['mike', 'julie', 'beetle', 'wasp', 'dragonfly', 'moth', 'firefly', 'mosquito'],
  effects: [
    'explosion-smoke',
    'explosion-fire',
    'shot-trail',
    'power-ammo',
    'power-life',
    'power-shield',
    'power-rapid-fire',
  ],
} as const satisfies Record<string, readonly SpriteName[]>;

type AtlasName = keyof typeof ATLAS_SPRITES;

/**
 * The layers of the city for each time of day, back to front; the night has no clouds. Each is an
 * image of its own in world pixels: two layers side by side would pass `SETTINGS.atlas.maxSize`,
 * and twice the pixels would take four times the memory for a background that scrolls.
 */
const BACKGROUND_LAYERS = {
  day: ['sky', 'clouds', 'far', 'mid', 'near'],
  night: ['sky', 'far', 'mid', 'near'],
} as const satisfies Record<TimeOfDay, readonly CityLayer[]>;

/** Each game sound's file under `assets-src/sounds`, as `assets-src/README.md` lists them. */
const SOUND_SOURCES = {
  shot: 'kenney-sci-fi-sounds/laserSmall_001.ogg',
  explosion: 'kenney-sci-fi-sounds/explosionCrunch_000.ogg',
  hit: 'kenney-impact-sounds/impactPunch_heavy_002.ogg',
  pickup: 'kenney-sci-fi-sounds/laserRetro_000.ogg',
} as const satisfies Record<GameSound, string>;

export interface AtlasPlan extends PackedAtlas<SpriteName> {
  readonly name: AtlasName;
  /** SHA-256 of the settings, the layout and the SVG of every frame. */
  readonly input: string;
}

export interface BackgroundPlan {
  readonly time: TimeOfDay;
  readonly layer: CityLayer;
  readonly width: number;
  readonly height: number;
  /** SHA-256 of the settings and the layer's SVG. */
  readonly input: string;
}

export interface SoundPlan {
  readonly id: GameSound;
  /** The Ogg file, relative to `assets-src/sounds`. */
  readonly source: string;
  /** SHA-256 of the Ogg file. */
  readonly input: string;
}

export interface AssetPlan {
  readonly atlases: readonly AtlasPlan[];
  readonly backgrounds: readonly BackgroundPlan[];
  readonly sounds: readonly SoundPlan[];
}

/**
 * Decides what the pipeline makes, without rasterizing or encoding anything: the layout of each
 * atlas and a hash of every output's input. The manifest test runs it in CI to check that the
 * committed files are up to date. `readSound` returns the bytes of a file under `assets-src/sounds`.
 */
export function planAssets(readSound: (source: string) => Uint8Array): AssetPlan {
  const atlases = entries(ATLAS_SPRITES).map(([name, sprites]): AtlasPlan => {
    const packed = packShelves(
      sprites.map((sprite) => ({ name: sprite, ...SPRITES[sprite] })),
      SETTINGS.atlas,
    );
    const hash = createHash('sha256').update(JSON.stringify(SETTINGS));
    for (const { name: sprite, frame, x, y } of packed.placements) {
      hash.update(`\n${sprite} ${String(frame)} ${String(x)} ${String(y)}\n`);
      hash.update(frameSvg(sprite, frame));
    }
    return { name, ...packed, input: hash.digest('hex') };
  });

  const backgrounds = entries(BACKGROUND_LAYERS).flatMap(([time, layers]) =>
    layers.map((layer): BackgroundPlan => ({
      time,
      layer,
      ...WORLD_SIZE,
      input: createHash('sha256')
        .update(JSON.stringify(SETTINGS))
        .update(cityLayerSvg(time, layer))
        .digest('hex'),
    })),
  );

  const sounds = entries(SOUND_SOURCES).map(([id, source]): SoundPlan => ({
    id,
    source,
    input: createHash('sha256').update(readSound(source)).digest('hex'),
  }));

  return { atlases, backgrounds, sounds };
}

/** `Object.entries` that keeps the key type of a record whose keys are all known. */
function entries<K extends string, V>(record: Readonly<Record<K, V>>): [K, V][] {
  // The records here are `as const` literals: they have exactly the keys of their type.
  return Object.entries(record) as [K, V][];
}
