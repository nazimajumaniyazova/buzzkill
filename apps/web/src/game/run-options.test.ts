import { join } from 'node:path';

import { gameVersion } from '@buzzkill/config/game-version';
import { describe, expect, it } from 'vitest';

import { GAME_VERSION, seedForRun } from './run-options';

describe('run options', () => {
  it('names the release and the simulation sources it was built from', () => {
    expect(GAME_VERSION).toBe(gameVersion(join(import.meta.dirname, '../../../..')));
  });

  it('uses a 32-bit seed from the URL', () => {
    expect(seedForRun('?seed=42', () => 7)).toBe(42);
    expect(seedForRun('?mode=day&seed=4294967295', () => 7)).toBe(0xff_ff_ff_ff);
  });

  it.each(['', '?seed=', '?seed=-1', '?seed=1.5', '?seed=abc', '?seed=4294967296'])(
    'falls back to a random seed for %j',
    (search) => {
      expect(seedForRun(search, () => -1)).toBe(0xff_ff_ff_ff);
    },
  );

  it('draws a random seed from the crypto API by default', () => {
    const seed = seedForRun('');

    expect(Number.isInteger(seed) && seed >= 0 && seed <= 0xff_ff_ff_ff).toBe(true);
  });
});
