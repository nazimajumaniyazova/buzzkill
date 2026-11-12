import type { AssetManifest } from '@buzzkill/engine';
import type { GameSound } from '@buzzkill/game';

import { ATLASES, BACKGROUNDS, SOUNDS } from '../assets/manifest.gen';

type BackgroundId = (typeof BACKGROUNDS)[keyof typeof BACKGROUNDS][number]['id'];

type BackgroundImages = Readonly<
  Record<BackgroundId, { readonly kind: 'image'; readonly url: string }>
>;

/** Every layer of the city, of both times of day, as an image entry keyed by its id. */
function backgroundImages(): BackgroundImages {
  const layers = [...BACKGROUNDS.day, ...BACKGROUNDS.night];
  // `Object.fromEntries` drops the key types; the entries have exactly the ids of the layers.
  return Object.fromEntries(
    layers.map(({ id, url }) => [id, { kind: 'image', url }]),
  ) as BackgroundImages;
}

/**
 * Everything the game loads before the first frame: the atlases, the layers of the city and the
 * sounds of the generated manifest (`pnpm assets`, ADR-0016). The loading starts before the
 * player picks the time of day, so both cities load. Each sound is an Ogg file with a WAV that
 * only a browser unable to decode Ogg downloads. Sounds are optional: without Web Audio the game
 * runs silently instead of failing to load.
 */
export const GAME_ASSETS = {
  creatures: { kind: 'image', url: ATLASES.creatures.url },
  effects: { kind: 'image', url: ATLASES.effects.url },
  ...backgroundImages(),
  shot: { kind: 'audio', ...SOUNDS.shot, optional: true },
  explosion: { kind: 'audio', ...SOUNDS.explosion, optional: true },
  hit: { kind: 'audio', ...SOUNDS.hit, optional: true },
} as const satisfies AssetManifest & Record<GameSound, unknown>;

export type GameAssetManifest = typeof GAME_ASSETS;
