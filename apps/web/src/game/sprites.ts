import { createGridAtlas, type SpriteAtlas } from '@buzzkill/engine';
import { DAY_ENEMIES, NIGHT_ENEMIES, RULES } from '@buzzkill/game';

import type { GameAssetManifest } from './assets';

/** The image entries of the manifest. */
type ImageId = {
  [K in keyof GameAssetManifest]: GameAssetManifest[K]['kind'] extends 'image' ? K : never;
}[keyof GameAssetManifest];

export interface GameSprites<TImage> {
  /** Enemy atlases by sheet name. A sheet without art has no atlas and is drawn as a box. */
  readonly enemies: Readonly<Partial<Record<string, SpriteAtlas<TImage>>>>;
  readonly projectile: SpriteAtlas<TImage>;
  /** By explosion variant: 0 is smoke, 1 is fire, as the simulation rolls them. */
  readonly explosions: readonly [SpriteAtlas<TImage>, SpriteAtlas<TImage>];
}

/** Cuts the loaded sheets into atlases with the frame data of the game configuration. */
export function createGameSprites<TImage>(
  images: Readonly<Record<ImageId, TImage>>,
): GameSprites<TImage> {
  const enemies: Partial<Record<string, SpriteAtlas<TImage>>> = {};
  for (const { sprite } of [...DAY_ENEMIES, ...NIGHT_ENEMIES]) {
    if (sprite.sheet in images) {
      enemies[sprite.sheet] = createGridAtlas(images[sprite.sheet as ImageId], sprite);
    }
  }
  const { size, frames } = RULES.explosion;
  const explosion = (image: TImage) =>
    createGridAtlas(image, { frameWidth: size, frameHeight: size, frames });

  return {
    enemies,
    projectile: createGridAtlas(images.projectile, {
      frameWidth: RULES.projectile.width,
      frameHeight: RULES.projectile.height,
      frames: 1,
    }),
    explosions: [explosion(images.smokeExplosion), explosion(images.fireExplosion)],
  };
}
