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
  /** Stored and edited now; the strings follow it with i18n (#111). */
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
 * field that fails its check falls back to its default on its own, so one broken value never
 * costs the player the rest of the settings.
 */
const storedSettingsSchema = z.object({
  version: z.literal(SETTINGS_VERSION),
  theme: z.catch(z.enum(THEMES), DEFAULT_SETTINGS.theme),
  muted: z.catch(z.boolean(), DEFAULT_SETTINGS.muted),
  effectsVolume: volume(DEFAULT_SETTINGS.effectsVolume),
  musicVolume: volume(DEFAULT_SETTINGS.musicVolume),
  difficulty: z.catch(z.enum(DIFFICULTIES), DEFAULT_SETTINGS.difficulty),
  language: z.catch(z.enum(LANGUAGES), DEFAULT_SETTINGS.language),
  // A fresh copy each time: the schema's output is mutable, the defaults are not.
  keyBindings: z.catch(keyBindingsSchema, () => ({
    moveUp: [...DEFAULT_KEY_BINDINGS.moveUp],
    moveDown: [...DEFAULT_KEY_BINDINGS.moveDown],
    fire: [...DEFAULT_KEY_BINDINGS.fire],
    pause: [...DEFAULT_KEY_BINDINGS.pause],
  })),
});

/**
 * Validates stored data of the current version: the settings, or `null` when it is not a settings
 * object of this version at all. Unknown fields are dropped. Never throws.
 */
export function parseSettings(data: unknown): Settings | null {
  const result = storedSettingsSchema.safeParse(data);
  if (!result.success) {
    return null;
  }
  const { theme, muted, effectsVolume, musicVolume, difficulty, language, keyBindings } =
    result.data;
  return { theme, muted, effectsVolume, musicVolume, difficulty, language, keyBindings };
}
