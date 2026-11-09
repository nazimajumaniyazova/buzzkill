import { DEFAULT_SETTINGS, SETTINGS_VERSION } from './schema';

type Stored = Readonly<Record<string, unknown>>;

/**
 * One pure step per version: `MIGRATIONS[n]` turns stored version `n` into `n + 1`. A step only
 * moves data; the schema validates the result, so a step may carry a broken value along.
 */
export const MIGRATIONS: Readonly<Record<number, (data: Stored) => Stored>> = {
  // Version 0 is the theme setting of #75, a bare string under its own key. Every other setting
  // is new in version 1, so it starts at its default.
  0: (data) => ({ ...DEFAULT_SETTINGS, theme: data['theme'], version: 1 }),
};

function isStored(data: unknown): data is Stored {
  return typeof data === 'object' && data !== null && !Array.isArray(data);
}

/**
 * Runs the steps from the stored version to `SETTINGS_VERSION`. Returns the data at the current
 * version, or `null` for a version without a way forward: a newer build's, or not a version.
 */
export function migrateSettings(data: unknown): Stored | null {
  if (!isStored(data)) {
    return null;
  }
  let current = data;
  for (;;) {
    const version = current['version'];
    if (version === SETTINGS_VERSION) {
      return current;
    }
    const step = typeof version === 'number' ? MIGRATIONS[version] : undefined;
    if (typeof version !== 'number' || step === undefined) {
      return null;
    }
    const next = step(current);
    // A step that does not move exactly one version forward would loop or skip one.
    if (next['version'] !== version + 1) {
      return null;
    }
    current = next;
  }
}
