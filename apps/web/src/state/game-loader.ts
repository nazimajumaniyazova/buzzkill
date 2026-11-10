import type { AssetFailure } from '@buzzkill/engine';
import { createBrowserAudioContext } from '@buzzkill/engine/browser';

import { type GameChunk, importGameChunk } from '../game/import-chunk';
import type { GameAssets } from './machine';
import { createStore, type ReadableStore } from './store';

/** Where the game's loading stands. */
export type GameLoad =
  | { readonly status: 'idle' }
  /** The chunk, then the files; `fraction` counts the files, from 0 to 1. */
  | { readonly status: 'loading'; readonly fraction: number }
  /** The chunk did not download: the network failed, or a new deploy replaced it. */
  | { readonly status: 'codeFailed' }
  /** Some files failed to load; the list says which and why. */
  | { readonly status: 'assetsFailed'; readonly failures: readonly AssetFailure[] }
  | { readonly status: 'ready'; readonly assets: GameAssets };

/**
 * The game's loading (#112), apart from the flow: it starts on the menu and goes on while the
 * player moves between screens. Its state is read through `useStore`; the commands are properties,
 * so they can be passed around detached.
 */
export interface GameLoader extends ReadableStore<GameLoad> {
  /**
   * Starts loading the game: the chunk, then the files with progress. Does nothing while it loads
   * or once it has; after a failure it starts again. Cheap to call on every hover.
   */
  readonly load: () => void;
  /**
   * Starts the page's audio: call it inside a gesture, since browsers start audio only then. The
   * context exists from the first `load`, so this works while the game is still loading.
   */
  readonly unlockAudio: () => void;
}

export interface GameLoaderOptions {
  /** Downloads the game chunk; tests give a chunk of their own. */
  readonly importChunk?: () => Promise<Pick<GameChunk, 'loadGameAssets'>>;
  /** Creates the page's audio context, or `null` without Web Audio. */
  readonly createAudioContext?: () => AudioContext | null;
}

const IDLE: GameLoad = { status: 'idle' };

export function createGameLoader({
  importChunk = importGameChunk,
  createAudioContext = () => createBrowserAudioContext(),
}: GameLoaderOptions = {}): GameLoader {
  const store = createStore((_previous: GameLoad, next: GameLoad) => next, IDLE);
  // One context for the visit, created before any gesture so that the sounds can be decoded on
  // it; `undefined` until the first load, `null` without Web Audio.
  let audioContext: AudioContext | null | undefined;
  const contextForAudio = (): AudioContext | null => {
    audioContext ??= createAudioContext();
    return audioContext;
  };

  const run = async (): Promise<void> => {
    const context = contextForAudio();
    store.send({ status: 'loading', fraction: 0 });
    let chunk: Pick<GameChunk, 'loadGameAssets'>;
    try {
      chunk = await importChunk();
    } catch {
      store.send({ status: 'codeFailed' });
      return;
    }
    const result = await chunk.loadGameAssets(context, (fraction) => {
      store.send({ status: 'loading', fraction });
    });
    store.send(
      result.ok
        ? { status: 'ready', assets: result.assets }
        : { status: 'assetsFailed', failures: result.failures },
    );
  };

  return {
    getState: store.getState,
    subscribe: store.subscribe,
    load() {
      const { status } = store.getState();
      if (status !== 'loading' && status !== 'ready') {
        void run();
      }
    },
    unlockAudio() {
      // A refusal leaves the audio off; the next gesture tries again.
      contextForAudio()
        ?.resume()
        .catch(() => undefined);
    },
  };
}
