// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS, type Settings } from './schema';
import type { SettingsStorage } from './storage';
import { createSettingsStore, persistSettings, settingsTransition, volumeOf } from './store';

describe('settingsTransition', () => {
  it('merges the changed fields and keeps the rest', () => {
    const next = settingsTransition(DEFAULT_SETTINGS, {
      type: 'change',
      changes: { theme: 'night', effectsVolume: 1 },
    });

    expect(next).toEqual({ ...DEFAULT_SETTINGS, theme: 'night', effectsVolume: 1 });
  });

  it('returns the same object when nothing differs, so the store stays quiet', () => {
    expect(settingsTransition(DEFAULT_SETTINGS, { type: 'change', changes: {} })).toBe(
      DEFAULT_SETTINGS,
    );
    expect(
      settingsTransition(DEFAULT_SETTINGS, { type: 'change', changes: { muted: false } }),
    ).toBe(DEFAULT_SETTINGS);
  });
});

describe('volumeOf', () => {
  it('gives each group its level, or silence while muted', () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, effectsVolume: 0.7, musicVolume: 0.2 };

    expect(volumeOf(settings, 'effects')).toBe(0.7);
    expect(volumeOf(settings, 'music')).toBe(0.2);
    expect(volumeOf({ ...settings, muted: true }, 'effects')).toBe(0);
    expect(volumeOf({ ...settings, muted: true }, 'music')).toBe(0);
  });
});

describe('createSettingsStore', () => {
  it('starts with the defaults and notifies on a change', () => {
    const store = createSettingsStore();
    const listener = vi.fn();
    store.subscribe(listener);

    expect(store.getState()).toBe(DEFAULT_SETTINGS);

    store.send({ type: 'change', changes: { muted: true } });
    store.send({ type: 'change', changes: { muted: true } });

    expect(store.getState().muted).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('starts from the settings it is given', () => {
    const store = createSettingsStore({ ...DEFAULT_SETTINGS, theme: 'day' });

    expect(store.getState().theme).toBe('day');
  });
});

describe('persistSettings', () => {
  function createStorage() {
    const setItem = vi.fn<SettingsStorage['setItem']>();
    const storage: SettingsStorage = { getItem: () => null, setItem, removeItem: vi.fn() };
    return { storage, setItem };
  }

  it('saves every change, and nothing while nothing changes', () => {
    const { storage, setItem } = createStorage();
    const store = createSettingsStore();
    persistSettings(store, storage);
    expect(setItem).not.toHaveBeenCalled();

    store.send({ type: 'change', changes: { theme: 'night' } });
    store.send({ type: 'change', changes: { theme: 'night' } });

    expect(setItem).toHaveBeenCalledOnce();
    expect(JSON.parse(setItem.mock.calls[0]?.[1] ?? '')).toMatchObject({ theme: 'night' });
  });

  it('stops saving once disconnected', () => {
    const { storage, setItem } = createStorage();
    const store = createSettingsStore();
    const disconnect = persistSettings(store, storage);

    disconnect();
    store.send({ type: 'change', changes: { theme: 'night' } });

    expect(setItem).not.toHaveBeenCalled();
  });
});
