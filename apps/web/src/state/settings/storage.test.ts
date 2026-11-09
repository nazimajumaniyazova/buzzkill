// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, type Settings, SETTINGS_VERSION } from './schema';
import {
  LEGACY_THEME_KEY,
  loadSettings,
  saveSettings,
  SETTINGS_KEY,
  type SettingsStorage,
} from './storage';

/** An in-memory `localStorage` that records the writes. */
function createStorage(entries: Record<string, string> = {}) {
  const items = new Map(Object.entries(entries));
  const writes: string[] = [];
  const storage: SettingsStorage = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      writes.push(`set ${key}`);
      items.set(key, value);
    },
    removeItem: (key) => {
      writes.push(`remove ${key}`);
      items.delete(key);
    },
  };
  return { storage, items, writes };
}

const custom: Settings = { ...DEFAULT_SETTINGS, theme: 'day', effectsVolume: 0.8 };

describe('loadSettings', () => {
  it('gives the defaults when nothing is stored, and writes nothing', () => {
    const { storage, writes } = createStorage();

    expect(loadSettings(storage)).toBe(DEFAULT_SETTINGS);
    expect(writes).toEqual([]);
  });

  it('reads back what saveSettings wrote, under one key with the version', () => {
    const { storage, items } = createStorage();

    saveSettings(custom, storage);

    expect(JSON.parse(items.get(SETTINGS_KEY) ?? '')).toEqual({
      version: SETTINGS_VERSION,
      ...custom,
    });
    expect(loadSettings(storage)).toEqual(custom);
  });

  it('migrates the theme of #75 from its old key once: written in the new form, old key removed', () => {
    const { storage, items, writes } = createStorage({ [LEGACY_THEME_KEY]: 'night' });

    expect(loadSettings(storage)).toEqual({ ...DEFAULT_SETTINGS, theme: 'night' });
    expect(writes).toEqual([`set ${SETTINGS_KEY}`, `remove ${LEGACY_THEME_KEY}`]);
    expect(items.has(LEGACY_THEME_KEY)).toBe(false);

    writes.length = 0;
    expect(loadSettings(storage)).toEqual({ ...DEFAULT_SETTINGS, theme: 'night' });
    expect(writes).toEqual([]);
  });

  it('prefers the settings object over the old key', () => {
    const { storage } = createStorage({
      [SETTINGS_KEY]: JSON.stringify({ version: SETTINGS_VERSION, ...custom }),
      [LEGACY_THEME_KEY]: 'night',
    });

    expect(loadSettings(storage).theme).toBe('day');
  });

  it('falls back to the defaults on broken JSON and keeps it for a human to look at', () => {
    const { storage, writes } = createStorage({ [SETTINGS_KEY]: '{"version": 1, "theme": ' });

    expect(loadSettings(storage)).toBe(DEFAULT_SETTINGS);
    expect(writes).toEqual([]);
  });

  it('falls back to the defaults on a newer version and leaves it for the newer build', () => {
    const newer = JSON.stringify({ version: SETTINGS_VERSION + 1, theme: 'day' });
    const { storage, items, writes } = createStorage({ [SETTINGS_KEY]: newer });

    expect(loadSettings(storage)).toBe(DEFAULT_SETTINGS);
    expect(writes).toEqual([]);
    expect(items.get(SETTINGS_KEY)).toBe(newer);
  });

  it('keeps the good fields of a stored object with a broken one', () => {
    const { storage } = createStorage({
      [SETTINGS_KEY]: JSON.stringify({ version: SETTINGS_VERSION, ...custom, musicVolume: -1 }),
    });

    expect(loadSettings(storage)).toEqual(custom);
  });

  it('survives a storage that throws or is missing', () => {
    const blocked: SettingsStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };

    expect(loadSettings(blocked)).toBe(DEFAULT_SETTINGS);
    expect(() => {
      saveSettings(custom, blocked);
    }).not.toThrow();
    expect(loadSettings(null)).toBe(DEFAULT_SETTINGS);
    expect(() => {
      saveSettings(custom, null);
    }).not.toThrow();
  });
});
