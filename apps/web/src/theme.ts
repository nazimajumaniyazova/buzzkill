import type { ThemeName } from '@buzzkill/ui';

/** The player's theme setting: follow the system preference, or one theme regardless of it. */
export type ThemeChoice = 'system' | ThemeName;

/**
 * Sets the theme on the root element (#75). `system` removes the attribute, and the stylesheet
 * then follows `prefers-color-scheme`; a theme name pins it. The choice itself is a setting
 * (#110), stored with the others.
 */
export function applyTheme(theme: ThemeChoice, root: Element = document.documentElement): void {
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}
