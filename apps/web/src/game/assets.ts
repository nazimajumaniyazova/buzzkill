import type { AssetManifest } from '@buzzkill/engine';
import type { GameSound } from '@buzzkill/game';

import { ATLASES, SOUNDS } from '../assets/manifest.gen';

/**
 * Everything the game loads before the first frame: the atlases and the sounds of the generated
 * manifest (`pnpm assets`, ADR-0016). Each sound is an Ogg file with a WAV that only a browser
 * unable to decode Ogg downloads. Sounds are optional: without Web Audio the game runs silently
 * instead of failing to load.
 */
export const GAME_ASSETS = {
  creatures: { kind: 'image', url: ATLASES.creatures.url },
  effects: { kind: 'image', url: ATLASES.effects.url },
  shot: { kind: 'audio', ...SOUNDS.shot, optional: true },
  explosion: { kind: 'audio', ...SOUNDS.explosion, optional: true },
  hit: { kind: 'audio', ...SOUNDS.hit, optional: true },
} as const satisfies AssetManifest & Record<GameSound, unknown>;

export type GameAssetManifest = typeof GAME_ASSETS;
