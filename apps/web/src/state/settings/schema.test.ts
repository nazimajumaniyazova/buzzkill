// @vitest-environment node
import { DEFAULT_KEY_BINDINGS } from '@buzzkill/game';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SETTINGS,
  defaultSettings,
  parseSettings,
  preferredLanguage,
  type Settings,
  SETTINGS_VERSION,
} from './schema';

/** The stored form of a settings object: the fields and the version. */
const stored = (settings: Settings = DEFAULT_SETTINGS): Record<string, unknown> => ({
  version: SETTINGS_VERSION,
  ...settings,
});

describe('DEFAULT_SETTINGS', () => {
  it('gives every setting a default and the game its default keys', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      theme: 'system',
      muted: false,
      effectsVolume: 0.3,
      musicVolume: 0.5,
      difficulty: 'normal',
      language: 'en',
      keyBindings: DEFAULT_KEY_BINDINGS,
    });
  });

  it('passes its own schema', () => {
    expect(parseSettings(stored())).toEqual(DEFAULT_SETTINGS);
  });
});

describe('parseSettings', () => {
  it('reads every field of the current version', () => {
    const settings: Settings = {
      theme: 'night',
      muted: true,
      effectsVolume: 1,
      musicVolume: 0,
      difficulty: 'hard',
      language: 'ru',
      keyBindings: {
        moveUp: ['KeyW', 'ArrowUp'],
        moveDown: ['KeyS', 'ArrowDown'],
        fire: ['KeyF', 'Space'],
        pause: ['KeyP', 'Escape'],
      },
    };

    expect(parseSettings(stored(settings))).toEqual(settings);
  });

  it('replaces a broken field with its default and keeps the others', () => {
    const parsed = parseSettings({
      ...stored(),
      theme: 'sepia',
      muted: 'yes',
      effectsVolume: 3,
      musicVolume: Number.NaN,
      difficulty: 'nightmare',
      language: 42,
    });

    expect(parsed).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ ...stored(), theme: 'sepia', musicVolume: 0.1 })).toEqual({
      ...DEFAULT_SETTINGS,
      musicVolume: 0.1,
    });
  });

  it('fills a missing field with its default and drops unknown ones', () => {
    expect(parseSettings({ version: SETTINGS_VERSION, theme: 'day', cheats: true })).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'day',
    });
  });

  it('falls back to the default keys when an action has the wrong number of keys', () => {
    const keyBindings = { ...DEFAULT_KEY_BINDINGS, fire: ['Space'] };

    expect(parseSettings({ ...stored(), keyBindings })?.keyBindings).toEqual(DEFAULT_KEY_BINDINGS);
  });

  it('falls back to the default keys when a key is bound twice', () => {
    const keyBindings = { ...DEFAULT_KEY_BINDINGS, fire: ['Space', 'KeyW'] };

    expect(parseSettings({ ...stored(), keyBindings })?.keyBindings).toEqual(DEFAULT_KEY_BINDINGS);
  });

  it('falls back to the default keys when an action is missing or a key is empty', () => {
    const withoutPause = {
      moveUp: DEFAULT_KEY_BINDINGS.moveUp,
      moveDown: DEFAULT_KEY_BINDINGS.moveDown,
      fire: DEFAULT_KEY_BINDINGS.fire,
    };
    const emptyKey = { ...DEFAULT_KEY_BINDINGS, pause: ['', 'KeyP'] };

    expect(parseSettings({ ...stored(), keyBindings: withoutPause })?.keyBindings).toEqual(
      DEFAULT_KEY_BINDINGS,
    );
    expect(parseSettings({ ...stored(), keyBindings: emptyKey })?.keyBindings).toEqual(
      DEFAULT_KEY_BINDINGS,
    );
  });

  it('rejects another version and anything that is not an object', () => {
    expect(parseSettings({ ...stored(), version: SETTINGS_VERSION + 1 })).toBeNull();
    expect(parseSettings({ ...stored(), version: undefined })).toBeNull();
    expect(parseSettings(null)).toBeNull();
    expect(parseSettings('night')).toBeNull();
    expect(parseSettings([stored()])).toBeNull();
  });

  it('takes a missing or broken field from the given defaults', () => {
    const russian = defaultSettings(['ru-RU']);

    expect(parseSettings({ version: SETTINGS_VERSION, theme: 'day' }, russian)).toEqual({
      ...russian,
      theme: 'day',
    });
    expect(parseSettings({ ...stored(), language: 'fr' }, russian)?.language).toBe('ru');
  });

  it('keeps a stored language over the defaults', () => {
    expect(parseSettings(stored(), defaultSettings(['ru']))?.language).toBe('en');
  });
});

describe('preferredLanguage', () => {
  it.each([
    [['ru-RU', 'en-US'], 'ru'],
    [['en-GB', 'ru'], 'en'],
    [['de-DE', 'ru'], 'ru'],
    [['RU'], 'ru'],
    [['de', 'fr-FR'], 'en'],
    [[], 'en'],
  ])('gives %j the language %s', (tags, language) => {
    expect(preferredLanguage(tags)).toBe(language);
  });
});

describe('defaultSettings', () => {
  it('is DEFAULT_SETTINGS in the preferred language', () => {
    expect(defaultSettings(['ru-RU'])).toEqual({ ...DEFAULT_SETTINGS, language: 'ru' });
    expect(defaultSettings(['en-US'])).toEqual(DEFAULT_SETTINGS);
  });
});
