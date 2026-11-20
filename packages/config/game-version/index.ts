import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The folders whose code `simulate` runs: the engine without its browser part (dependency-cruiser
 * keeps the rest of the engine from importing it) and the game.
 */
const SIMULATION_SOURCES = ['packages/engine/src', 'packages/game/src'];

/** Code the simulation never runs: tests, benchmarks and the engine's browser part. */
function isSimulationSource(path: string): boolean {
  return (
    path.endsWith('.ts') &&
    !path.endsWith('.test.ts') &&
    !path.endsWith('.bench.ts') &&
    !path.startsWith('packages/engine/src/browser/')
  );
}

/**
 * The version written into every replay and baked into the server function (ADR-0009, amendment
 * of 2026-11-20): the release from the root `package.json`, then, as semver build metadata, the
 * first 12 hex digits of a SHA-256 of the simulation's sources, such as `0.36.0+1f2e3d4c5b6a`.
 *
 * The release alone changes only when release-please tags one, while every commit to `main` is
 * deployed: two builds that play differently would share it, and the server would call an honest
 * replay a forgery. The hash changes with every change to the simulation and only with one, so a
 * deploy that leaves the game alone keeps the replays of open tabs valid. Paths are part of it, and
 * line endings are not, so a checkout on Windows hashes as one on Linux.
 *
 * @param root The repository root.
 */
export function gameVersion(root: string): string {
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    // The root package.json is the repository's own file, and release-please writes the version.
    version: string;
  };

  const hash = createHash('sha256');
  const paths = SIMULATION_SOURCES.flatMap((folder) =>
    readdirSync(join(root, folder), { recursive: true, encoding: 'utf8' }).map((path) =>
      `${folder}/${path}`.replaceAll('\\', '/'),
    ),
  )
    .filter(isSimulationSource)
    .sort();
  for (const path of paths) {
    const text = readFileSync(join(root, path), 'utf8').replaceAll('\r\n', '\n');
    hash.update(`${path}\0${text}\0`);
  }
  return `${version}+${hash.digest('hex').slice(0, 12)}`;
}
