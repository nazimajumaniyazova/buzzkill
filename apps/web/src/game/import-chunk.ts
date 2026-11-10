import type * as GameChunkModule from './game-chunk';

/** The modules of the game chunk, as `importGameChunk` gives them. */
export type GameChunk = typeof GameChunkModule;

/**
 * Downloads the game chunk (#112). The first call starts the request; the browser keeps the
 * module, so the loader and `React.lazy` share one download.
 */
export function importGameChunk(): Promise<GameChunk> {
  return import('./game-chunk');
}
