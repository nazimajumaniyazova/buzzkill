import { type AssetFailure, createAudioMixer, loadAssets } from '@buzzkill/engine';
import { createBrowserAssetDecoders } from '@buzzkill/engine/browser';
import type { GameSound } from '@buzzkill/game';

import type { GameAssets } from '../state/machine';
import { GAME_ASSETS } from './assets';
import { createGameSprites } from './sprites';

/** The game's files, ready for a run, or what failed to load. */
export type GameAssetsResult =
  | { readonly ok: true; readonly assets: GameAssets }
  | { readonly ok: false; readonly failures: readonly AssetFailure[] };

/**
 * Loads every file of the game in parallel and builds what a run draws and plays: the sprite
 * atlases and the mixer. The sounds are decoded on the page's audio context, which may still be
 * suspended; without one the mixer is silent and the optional sounds are skipped.
 */
export async function loadGameAssets(
  audioContext: AudioContext | null,
  onProgress: (fraction: number) => void,
): Promise<GameAssetsResult> {
  const result = await loadAssets(GAME_ASSETS, createBrowserAssetDecoders({ audioContext }), {
    onProgress: (progress) => {
      onProgress(progress.fraction);
    },
  });
  if (!result.ok) {
    return { ok: false, failures: result.failures };
  }
  const { assets } = result;
  const audio = createAudioMixer<GameSound, AudioBuffer>({
    context: audioContext,
    buffers: { shot: assets.shot, explosion: assets.explosion, hit: assets.hit },
  });
  return { ok: true, assets: { sprites: createGameSprites(assets), audio } };
}
