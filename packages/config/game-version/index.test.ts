import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { gameVersion } from './index';

const REPOSITORY = join(dirname(fileURLToPath(import.meta.url)), '../../..');

/** A repository with the root package.json and a few files where the real sources live. */
function write(root: string, path: string, text: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

describe('gameVersion', () => {
  let root = '';

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'buzzkill-version-'));
    write(root, 'package.json', '{ "name": "buzzkill", "version": "1.2.3" }');
    write(root, 'packages/engine/src/loop.ts', 'export const step = 1;\n');
    write(root, 'packages/engine/src/browser/audio.ts', 'export const volume = 1;\n');
    write(root, 'packages/game/src/rules.ts', 'export const damage = 2;\n');
    write(root, 'packages/game/src/rules.test.ts', 'it("hits", () => {});\n');
    write(root, 'packages/game/src/rules.bench.ts', 'bench("hits", () => {});\n');
    write(root, 'packages/game/src/replay/__snapshots__/golden.test.ts.snap', 'exports[1] = 1;\n');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('is the release with a hash of the simulation sources as build metadata', () => {
    expect(gameVersion(root)).toMatch(/^1\.2\.3\+[0-9a-f]{12}$/);
  });

  it('fits the runs table, whose game_version holds at most 32 characters', () => {
    expect(gameVersion(REPOSITORY).length).toBeLessThanOrEqual(32);
    const { version } = JSON.parse(readFileSync(join(REPOSITORY, 'package.json'), 'utf8')) as {
      version: string;
    };
    expect(gameVersion(REPOSITORY).startsWith(`${version}+`)).toBe(true);
  });

  it('is the same for the same sources', () => {
    expect(gameVersion(root)).toBe(gameVersion(root));
  });

  it('ignores line endings, which a Windows checkout may change', () => {
    const before = gameVersion(root);
    write(root, 'packages/game/src/rules.ts', 'export const damage = 2;\r\n');
    expect(gameVersion(root)).toBe(before);
  });

  it.each([
    ['a change to a game source', 'packages/game/src/rules.ts', 'export const damage = 3;\n'],
    ['a change to an engine source', 'packages/engine/src/loop.ts', 'export const step = 2;\n'],
    ['a new game source', 'packages/game/src/boss.ts', 'export const hp = 9;\n'],
  ])('changes with %s', (_, path, text) => {
    const before = gameVersion(root);
    write(root, path, text);
    expect(gameVersion(root)).not.toBe(before);
  });

  it('changes when a source moves, as an import of it would', () => {
    const before = gameVersion(root);
    rmSync(join(root, 'packages/game/src/rules.ts'));
    write(root, 'packages/game/src/rule.ts', 'export const damage = 2;\n');
    expect(gameVersion(root)).not.toBe(before);
  });

  it('changes with the release', () => {
    const before = gameVersion(root);
    write(root, 'package.json', '{ "name": "buzzkill", "version": "1.3.0" }');
    expect(gameVersion(root)).not.toBe(before);
    expect(gameVersion(root).split('+')[1]).toBe(before.split('+')[1]);
  });

  it.each([
    ['a test', 'packages/game/src/rules.test.ts'],
    ['a benchmark', 'packages/game/src/rules.bench.ts'],
    ['a snapshot', 'packages/game/src/replay/__snapshots__/golden.test.ts.snap'],
    ['the browser part of the engine', 'packages/engine/src/browser/audio.ts'],
    ['the web app', 'apps/web/src/App.tsx'],
  ])('stays the same with a change to %s, which the simulation never runs', (_, path) => {
    const before = gameVersion(root);
    write(root, path, '// changed\n');
    expect(gameVersion(root)).toBe(before);
  });
});
