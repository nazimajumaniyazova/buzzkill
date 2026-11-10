import { migrateSettings } from './migrations';
import { DEFAULT_SETTINGS, parseSettings, type Settings, SETTINGS_VERSION } from './schema';

/** Where the settings object lives in `localStorage`. */
export const SETTINGS_KEY = 'buzzkill.settings';

/** Where #75 kept the theme before the settings object: stored version 0. */
export const LEGACY_THEME_KEY = 'buzzkill.theme';

export type SettingsStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** `localStorage`, or `null` where touching it throws (sandboxed frames, some private modes). */
export function browserStorage(): SettingsStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** What is stored, as data: the settings object, the old theme as version 0, or nothing. */
function readStored(storage: SettingsStorage): unknown {
  const json = storage.getItem(SETTINGS_KEY);
  if (json !== null) {
    return JSON.parse(json);
  }
  const theme = storage.getItem(LEGACY_THEME_KEY);
  return theme === null ? undefined : { version: 0, theme };
}

/**
 * The stored settings, migrated to the current version and validated. Anything missing, broken,
 * from a newer build or unreadable gives `defaults`, with no error for the player. When a
 * migration ran, the result is written back at once, so the old form is read only once.
 */
export function loadSettings(
  storage: SettingsStorage | null,
  defaults: Settings = DEFAULT_SETTINGS,
): Settings {
  if (storage === null) {
    return defaults;
  }
  let stored: unknown;
  try {
    stored = readStored(storage);
  } catch {
    // Blocked storage or broken JSON. The data stays for a newer build or a human to look at.
    return defaults;
  }
  if (stored === undefined) {
    return defaults;
  }
  const current = migrateSettings(stored);
  const settings = parseSettings(current, defaults);
  if (settings === null) {
    return defaults;
  }
  // `migrateSettings` returns the stored object itself when it is of the current version.
  if (current !== stored) {
    saveSettings(settings, storage);
  }
  return settings;
}

/** Stores the settings with their version and drops the old theme key. Never throws. */
export function saveSettings(settings: Settings, storage: SettingsStorage | null): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify({ version: SETTINGS_VERSION, ...settings }));
    storage?.removeItem(LEGACY_THEME_KEY);
  } catch {
    // A full or blocked storage loses the settings for the next visit, never the page.
  }
}
