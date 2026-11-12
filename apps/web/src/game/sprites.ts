import type { SpriteAtlas } from '@buzzkill/engine';
import { DAY_ENEMIES, HEROES, type HeroId, NIGHT_ENEMIES } from '@buzzkill/game';

import { SPRITES } from '../assets/manifest.gen';
import type { GameAssetManifest } from './assets';

/** The image entries of the manifest. */
type ImageId = {
  [K in keyof GameAssetManifest]: GameAssetManifest[K]['kind'] extends 'image' ? K : never;
}[keyof GameAssetManifest];

/** A looping animation: its frames in an atlas and the ticks each frame stays on screen. */
interface Animation<TImage> {
  readonly atlas: SpriteAtlas<TImage>;
  readonly frameTicks: number;
}

export interface GameSprites<TImage> {
  readonly heroes: Readonly<Record<HeroId, Animation<TImage>>>;
  /** By the sprite name of each enemy configuration, its `sprite.sheet`. */
  readonly enemies: Readonly<Partial<Record<string, Animation<TImage>>>>;
  /** The shot in flight: a tail that fades behind the head, which is the hitbox. */
  readonly projectile: SpriteAtlas<TImage>;
  /** By explosion variant: 0 is smoke, 1 is fire, as the simulation rolls them. */
  readonly explosions: readonly [SpriteAtlas<TImage>, SpriteAtlas<TImage>];
}

/**
 * Cuts the loaded atlases into sprites with the frames of the generated manifest. The game
 * configuration names each sprite; a name the manifest lacks does not compile.
 */
export function createGameSprites<TImage>(
  images: Readonly<Record<ImageId, TImage>>,
): GameSprites<TImage> {
  const atlas = (name: keyof typeof SPRITES): SpriteAtlas<TImage> => ({
    image: images[SPRITES[name].atlas],
    frames: SPRITES[name].frames,
  });
  const animation = (name: keyof typeof SPRITES): Animation<TImage> => ({
    atlas: atlas(name),
    frameTicks: SPRITES[name].frameTicks,
  });

  const enemies: Partial<Record<string, Animation<TImage>>> = {};
  for (const { sprite } of [...DAY_ENEMIES, ...NIGHT_ENEMIES]) {
    enemies[sprite.sheet] = animation(sprite.sheet);
  }
  return {
    heroes: {
      male: animation(HEROES.male.sprite.sheet),
      female: animation(HEROES.female.sprite.sheet),
    },
    enemies,
    projectile: atlas('shot-trail'),
    explosions: [atlas('explosion-smoke'), atlas('explosion-fire')],
  };
}
