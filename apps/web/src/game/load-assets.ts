import { type AssetFailure, createAudioMixer, loadAssets } from '@buzzkill/engine';
import { createBrowserAssetDecoders } from '@buzzkill/engine/browser';
import type { GameSound } from '@buzzkill/game';

import type { GameAssets } from '../state/machine';
import { GAME_ASSETS } from './assets';
import { createMusicPlayer, documentVisibility } from './music';
import { MUSIC_TRACK } from './music-track';
import { createGameSprites } from './sprites';

/** The game's files, ready for a run, or what failed to load. */
export type GameAssetsResult =
  | { readonly ok: true; readonly assets: GameAssets }
  | { readonly ok: false; readonly failures: readonly AssetFailure[] };

/**
 * Loads every file of the game in parallel and builds what a run draws and plays: the sprite
 * atlases, the mixer and the music. The sounds are decoded on the page's audio context, which may
 * still be suspended; without one the mixer is silent and the optional sounds are skipped. The
 * music is not among the files: it streams once a run plays (#161).
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
  // Every sound of the game, checked against `GameSound`: the mixer takes a partial record, so a
  // sound left out here would compile and never play, as the pickup sound did (#181).
  const buffers = {
    shot: assets.shot,
    explosion: assets.explosion,
    hit: assets.hit,
    pickup: assets.pickup,
    bossPhase: assets.bossPhase,
  } satisfies Record<GameSound, AudioBuffer | undefined>;
  const audio = createAudioMixer<GameSound, AudioBuffer>({ context: audioContext, buffers });
  const music = createMusicPlayer(audio, {
    sources: MUSIC_TRACK,
    createElement: () => new Audio(),
    visibility: documentVisibility(document),
  });
  return { ok: true, assets: { sprites: createGameSprites(assets), audio, music } };
}
