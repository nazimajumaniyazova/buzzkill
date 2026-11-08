import type { ThemeName } from '@buzzkill/ui';

/** The player's theme setting: follow the system preference, or one theme regardless of it. */
export type ThemeChoice = 'system' | ThemeName;

const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'day', 'night'];

const STORAGE_KEY = 'buzzkill.theme';

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === 'string' && (THEME_CHOICES as readonly string[]).includes(value);
}

/** `localStorage`, or `null` where touching it throws (sandboxed frames, some private modes). */
function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The stored choice; `system` when nothing valid is stored or storage is unavailable. */
export function readThemeChoice(
  storage: Pick<Storage, 'getItem'> | null = safeStorage(),
): ThemeChoice {
  try {
    const stored = storage?.getItem(STORAGE_KEY);
    return isThemeChoice(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

/** Stores the choice. A full or blocked storage loses the setting, never the page. */
export function writeThemeChoice(
  choice: ThemeChoice,
  storage: Pick<Storage, 'setItem'> | null = safeStorage(),
): void {
  try {
    storage?.setItem(STORAGE_KEY, choice);
  } catch {
    // The choice still applies for this visit.
  }
}

/**
 * Sets the theme on the root element (#75). `system` removes the attribute, and the stylesheet
 * then follows `prefers-color-scheme`; a theme name pins it.
 */
export function applyTheme(theme: ThemeChoice, root: Element = document.documentElement): void {
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}
