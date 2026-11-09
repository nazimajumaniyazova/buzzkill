// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { migrateSettings, MIGRATIONS } from './migrations';
import { DEFAULT_SETTINGS, parseSettings, SETTINGS_VERSION } from './schema';

/**
 * One stored example of every past version, as a browser may still hold it. Version 0 is the bare
 * theme of #75, which the storage reads from its own key as `{ version: 0, theme }`.
 */
const FIXTURES: Readonly<Record<number, unknown>> = {
  0: { version: 0, theme: 'night' },
};

describe('MIGRATIONS', () => {
  it('has one step for every version before the current one, and a fixture for each', () => {
    const versions = Array.from({ length: SETTINGS_VERSION }, (_, version) => version);

    expect(Object.keys(MIGRATIONS).map(Number)).toEqual(versions);
    expect(Object.keys(FIXTURES).map(Number)).toEqual(versions);
  });

  it.each(Object.entries(MIGRATIONS))('step %s raises the version by one', (version, step) => {
    const fixture = FIXTURES[Number(version)] as Record<string, unknown>;

    expect(step(fixture)).toMatchObject({ version: Number(version) + 1 });
  });
});

describe('migrateSettings', () => {
  it('lifts the bare theme of version 0 into the settings, with defaults for the rest', () => {
    const migrated = migrateSettings(FIXTURES[0]);

    expect(parseSettings(migrated)).toEqual({ ...DEFAULT_SETTINGS, theme: 'night' });
  });

  it('carries a broken theme through, for the schema to replace with its default', () => {
    expect(parseSettings(migrateSettings({ version: 0, theme: 'sepia' }))).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it('returns the current version as it is', () => {
    const current = { version: SETTINGS_VERSION, theme: 'day' };

    expect(migrateSettings(current)).toBe(current);
  });

  it('gives up on a version it has no step for, and on what is not settings at all', () => {
    expect(migrateSettings({ version: SETTINGS_VERSION + 1 })).toBeNull();
    expect(migrateSettings({ version: -1 })).toBeNull();
    expect(migrateSettings({ version: 0.5 })).toBeNull();
    expect(migrateSettings({ version: '1' })).toBeNull();
    expect(migrateSettings({ theme: 'night' })).toBeNull();
    expect(migrateSettings(null)).toBeNull();
    expect(migrateSettings([FIXTURES[0]])).toBeNull();
    expect(migrateSettings('night')).toBeNull();
  });
});
