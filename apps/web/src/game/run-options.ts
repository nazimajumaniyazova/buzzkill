// Only the version field reaches the bundle: Vite tree-shakes named JSON imports.
import { version } from '../../../../package.json';

/**
 * The release that runs, written into every replay. release-please keeps it in the root
 * `package.json`; the stage 8 server re-simulates only replays of its own version (ADR-0009).
 */
export const GAME_VERSION: string = version;

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
