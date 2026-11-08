import '../src/tokens/tokens.css';
import './preview.css';

import type { Decorator, Preview } from '@storybook/react-vite';

import type { ThemeName } from '../src';

/** What the Theme toolbar offers: the system preference, or one theme pinned. */
type ThemeGlobal = 'system' | ThemeName;

const THEME_ITEMS = [
  { value: 'system', title: 'Match the system', icon: 'browser' },
  { value: 'day', title: 'Day', icon: 'sun' },
  { value: 'night', title: 'Night', icon: 'moon' },
] as const satisfies readonly { value: ThemeGlobal; title: string; icon: string }[];

/**
 * Sets `data-theme` on the root of the preview frame the way the shell does on the page: no
 * attribute means "follow prefers-color-scheme", a theme name pins it (ADR-0005, #75).
 */
const withTheme: Decorator = (Story, { globals }) => {
  const theme: unknown = globals['theme'];
  const root = document.documentElement;
  if (theme === 'day' || theme === 'night') {
    root.setAttribute('data-theme', theme);
  } else {
    root.removeAttribute('data-theme');
  }
  return <Story />;
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: 'Theme of the preview',
      toolbar: {
        title: 'Theme',
        icon: 'contrast',
        items: [...THEME_ITEMS],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'system' },
  parameters: {
    // Every story is an accessibility test: a violation fails it in the UI and under Vitest.
    a11y: { test: 'error' },
    // The theme sets the canvas color; the backgrounds toolbar would fight it.
    backgrounds: { disable: true },
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default preview;
