// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { MANIFEST_FILE, PATHS } from './paths';

/** Every file the generated manifest imports, relative to it: what the game ships. */
const shipped = [
  ...readFileSync(join(PATHS.output, MANIFEST_FILE), 'utf8').matchAll(
    /^import \w+ from '(.+)';$/gm,
  ),
].map(([, path = '']) => path);
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
      shipped
        .filter((path) => path.includes('/assets-src/'))
        .map((path) => dirname(resolve(PATHS.output, path))),
    );

    expect(packs.size).toBeGreaterThan(0);
    expect([...packs].filter((pack) => !existsSync(join(pack, 'License.txt')))).toEqual([]);
  });
});
