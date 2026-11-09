import type { VolumeGroup } from '@buzzkill/engine';

import { createStore, type Store } from '../store';
import { DEFAULT_SETTINGS, type Settings } from './schema';
import { saveSettings, type SettingsStorage } from './storage';

/** One event: the fields that change. */
export interface SettingsEvent {
  readonly type: 'change';
  readonly changes: Partial<Settings>;
}

/** Merges the changes; the same object comes back when nothing differs, so nobody is notified. */
export function settingsTransition(settings: Settings, event: SettingsEvent): Settings {
  const next: Settings = { ...settings, ...event.changes };
  const keys = Object.keys(settings) as (keyof Settings)[];
  return keys.every((key) => next[key] === settings[key]) ? settings : next;
}

/** The level the mixer gets for a group: the setting, or silence while muted. */
export function volumeOf(settings: Settings, group: VolumeGroup): number {
  if (settings.muted) {
    return 0;
  }
  return group === 'effects' ? settings.effectsVolume : settings.musicVolume;
}

export type SettingsStore = Store<Settings, SettingsEvent>;

/** The settings store of ADR-0006: the `createStore` of the machine with a reducer of changes. */
export function createSettingsStore(initial: Settings = DEFAULT_SETTINGS): SettingsStore {
  return createStore(settingsTransition, initial);
}

/** Saves the settings after every change. Returns the function that stops it. */
export function persistSettings(store: SettingsStore, storage: SettingsStorage | null): () => void {
  return store.subscribe(() => {
    saveSettings(store.getState(), storage);
  });
}
