import type { KeyBindings } from '@buzzkill/engine';
import { DEFAULT_KEY_BINDINGS, type GameAction } from '@buzzkill/game';
import * as z from 'zod/mini';

import type { ThemeChoice } from '../../theme';

/** The version of the stored settings object. A new version comes with a step in `MIGRATIONS`. */
export const SETTINGS_VERSION = 1;

const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

const LANGUAGES = ['en', 'ru'] as const;
export type Language = (typeof LANGUAGES)[number];

const THEMES = ['system', 'day', 'night'] as const satisfies readonly ThemeChoice[];

/** Every action has exactly this many keys; the settings screen shows a slot for each. */
export const KEYS_PER_ACTION = 2;

/** The player's settings (ADR-0006), kept in `localStorage` under a versioned schema. */
export interface Settings {
  readonly theme: ThemeChoice;
  /** Silences both volume groups without forgetting their levels. */
  readonly muted: boolean;
  /** From 0 to 1. */
  readonly effectsVolume: number;
  /** From 0 to 1. */
  readonly musicVolume: number;
  /** Stored and edited now; the game reads it once levels are balanced by it (stage 7). */
  readonly difficulty: Difficulty;
  /** The language of every string (ADR-0013); the browser's language until the player picks one. */
  readonly language: Language;
  /** `KeyboardEvent.code` values, `KEYS_PER_ACTION` per action, no key bound twice. */
  readonly keyBindings: KeyBindings<GameAction>;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  muted: false,
  effectsVolume: 0.3,
  musicVolume: 0.5,
  difficulty: 'normal',
  language: 'en',
  keyBindings: DEFAULT_KEY_BINDINGS,
};

/**
 * The first language of `tags` (`navigator.languages`, most preferred first) that the game
 * speaks, matched on the primary subtag: "ru-RU" gives Russian. English when none matches.
 */
export function preferredLanguage(tags: readonly string[]): Language {
  for (const tag of tags) {
    const primary = tag.split('-')[0]?.toLowerCase();
    const match = LANGUAGES.find((language) => language === primary);
    if (match !== undefined) {
      return match;
    }
  }
  return DEFAULT_SETTINGS.language;
}

/** The defaults of a player whose browser prefers `tags`: `DEFAULT_SETTINGS` in their language. */
export function defaultSettings(tags: readonly string[]): Settings {
  return { ...DEFAULT_SETTINGS, language: preferredLanguage(tags) };
}

function boundOnce(bindings: Readonly<Record<string, readonly string[]>>): boolean {
  const all = Object.values(bindings).flat();
  return new Set(all).size === all.length;
}

const keys = z
  .array(z.string().check(z.minLength(1), z.maxLength(32)))
  .check(z.length(KEYS_PER_ACTION));

const keyBindingsSchema = z
  .object({
    moveUp: keys,
    moveDown: keys,
    fire: keys,
    pause: keys,
  } satisfies Record<GameAction, typeof keys>)
  .check(z.refine(boundOnce, 'a key is bound to two actions'));

const volume = (fallback: number) => z.catch(z.number().check(z.gte(0), z.lte(1)), fallback);

/**
 * The stored form. The version must match; past versions go through `migrateSettings` first. A
 * field that is missing or fails its check falls back to its default on its own, so one broken
 * value never costs the player the rest of the settings.
 */
function storedSettingsSchema(defaults: Settings) {
  return z.object({
    version: z.literal(SETTINGS_VERSION),
    theme: z.catch(z.enum(THEMES), defaults.theme),
    muted: z.catch(z.boolean(), defaults.muted),
    effectsVolume: volume(defaults.effectsVolume),
    musicVolume: volume(defaults.musicVolume),
    difficulty: z.catch(z.enum(DIFFICULTIES), defaults.difficulty),
    language: z.catch(z.enum(LANGUAGES), defaults.language),
    // A fresh copy each time: the schema's output is mutable, the defaults are not.
    keyBindings: z.catch(keyBindingsSchema, () => ({
      moveUp: [...defaults.keyBindings.moveUp],
      moveDown: [...defaults.keyBindings.moveDown],
      fire: [...defaults.keyBindings.fire],
      pause: [...defaults.keyBindings.pause],
    })),
  });
}

/**
 * Validates stored data of the current version: the settings, or `null` when it is not a settings
 * object of this version at all. A missing or broken field takes its value from `defaults`.
 * Unknown fields are dropped. Never throws.
 */
export function parseSettings(
  data: unknown,
  defaults: Settings = DEFAULT_SETTINGS,
): Settings | null {
  const result = storedSettingsSchema(defaults).safeParse(data);
  if (!result.success) {
    return null;
  }
  const { theme, muted, effectsVolume, musicVolume, difficulty, language, keyBindings } =
    result.data;
  return { theme, muted, effectsVolume, musicVolume, difficulty, language, keyBindings };
}
