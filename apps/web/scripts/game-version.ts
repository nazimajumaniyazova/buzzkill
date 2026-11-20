import { fileURLToPath } from 'node:url';

import { gameVersion } from '@buzzkill/config/game-version';

const REPOSITORY = fileURLToPath(new URL('../../..', import.meta.url));

/**
 * The constants Vite and Vitest replace in the app's code: `__GAME_VERSION__`, the version of the
 * simulation this build plays, which every replay carries (ADR-0009, amendment of 2026-11-20).
 */
export function buildConstants(): Record<string, string> {
  return { __GAME_VERSION__: JSON.stringify(gameVersion(REPOSITORY)) };
}
