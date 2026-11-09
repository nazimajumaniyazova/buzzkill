import type { VolumeGroup } from '@buzzkill/engine';

import type { ThemeChoice } from '../theme';
import { createStore, type Store } from './store';

/**
 * The player's settings. The persisted, versioned form with Zod and its migrations arrives with
 * #110; until then the theme keeps its own key in `localStorage` (#75) and the rest lives for
 * the visit.
 */
export interface Settings {
  readonly theme: ThemeChoice;
  /** Silences both volume groups without forgetting their levels. */
  readonly muted: boolean;
  /** From 0 to 1. */
  readonly effectsVolume: number;
  /** From 0 to 1. */
  readonly musicVolume: number;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  muted: false,
  effectsVolume: 0.3,
  musicVolume: 0.5,
};

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

export function createSettingsStore(initial: Settings = DEFAULT_SETTINGS): SettingsStore {
  return createStore(settingsTransition, initial);
}
