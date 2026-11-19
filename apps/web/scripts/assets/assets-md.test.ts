// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { MANIFEST_FILE, PATHS } from './paths';

/** The files a module imports, as absolute paths. */
function imports(file: string): string[] {
  return [...readFileSync(file, 'utf8').matchAll(/^import \w+ from '(.+\.\w+)';$/gm)].map(
    ([, path = '']) => resolve(dirname(file), path),
  );
}

/** The downloaded files, under `assets-src`, each next to the license of its pack. */
const ASSETS_SRC = dirname(PATHS.sounds);

/**
 * What the game ships: every file the generated manifest imports, and the music, which streams
 * instead of loading with the rest (#161).
 */
const shipped = [...imports(join(PATHS.output, MANIFEST_FILE)), ...imports(PATHS.musicTrack)];
const shippedNames = shipped.map((path) => basename(path));

/** The file in the first column of each table row of ASSETS.md. */
const listed = [...readFileSync(PATHS.assetsMd, 'utf8').matchAll(/^\| `([^`]+)` +\|/gm)].map(
  ([, file = '']) => file,
);

describe('ASSETS.md', () => {
  it('has a row for every file the game ships', () => {
    expect(shipped.length).toBeGreaterThan(0);

    expect(shippedNames.filter((name) => !listed.includes(name))).toEqual([]);
  });

  it('lists no file the game no longer ships', () => {
    expect(listed.filter((file) => !shippedNames.includes(file))).toEqual([]);
  });

  it('has the license of every downloaded pack next to its files', () => {
    const packs = new Set(
      shipped.filter((path) => !relative(ASSETS_SRC, path).startsWith('..')).map(dirname),
    );

    expect(packs.size).toBeGreaterThan(0);
    expect([...packs].filter((pack) => !existsSync(join(pack, 'License.txt')))).toEqual([]);
  });
});
