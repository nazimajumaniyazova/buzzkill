// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  createSettingsStore,
  DEFAULT_SETTINGS,
  type Settings,
  settingsTransition,
  volumeOf,
} from './settings';

describe('settingsTransition', () => {
  it('merges the changed fields and keeps the rest', () => {
    const next = settingsTransition(DEFAULT_SETTINGS, {
      type: 'change',
      changes: { theme: 'night', effectsVolume: 1 },
    });

    expect(next).toEqual({ theme: 'night', muted: false, effectsVolume: 1, musicVolume: 0.5 });
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
