import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Where the pipeline reads and writes, as absolute paths. */
export const PATHS = {
  /** The downloaded sounds, as `assets-src/README.md` lists them. */
  sounds: join(WEB, 'assets-src/sounds'),
  /** The generated files the game loads, and their manifest. */
  output: join(WEB, 'src/assets'),
  /** The source, author and license of every file the game ships (#134). */
  assetsMd: join(WEB, '../../ASSETS.md'),
};

/** The generated manifest, in `PATHS.output`; ESLint, Prettier and CSpell skip `*.gen.ts`. */
export const MANIFEST_FILE = 'manifest.gen.ts';

/** The bytes of a sound under `assets-src/sounds`. */
export function readSound(source: string): Uint8Array {
  return readFileSync(join(PATHS.sounds, source));
}
