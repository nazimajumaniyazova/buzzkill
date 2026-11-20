/** Replaced at build time with `gameVersion()` of `@buzzkill/config` (vite.config.ts). */
declare const __GAME_VERSION__: string;

/**
 * The version of the simulation that runs, written into every replay: the release, then a hash of
 * the engine and game sources, such as `0.36.0+1f2e3d4c5b6a`. The server plays only replays of
 * the version it was built with (ADR-0009, amendment of 2026-11-20).
 */
export const GAME_VERSION: string = __GAME_VERSION__;

const MAX_SEED = 0xff_ff_ff_ff;

/**
 * The seed of a run: `?seed=` in the URL when it holds a 32-bit unsigned integer, so a bug report
 * or a demo can be replayed exactly (docs/architecture.md), otherwise a random one.
 */
export function seedForRun(
  search: string,
  randomWord: () => number = () => crypto.getRandomValues(new Uint32Array(1))[0] ?? 0,
): number {
  const fromUrl = new URLSearchParams(search).get('seed');
  if (fromUrl !== null && /^\d{1,10}$/.test(fromUrl)) {
    const seed = Number(fromUrl);
    if (seed <= MAX_SEED) {
      return seed;
    }
  }
  return randomWord() >>> 0;
}
