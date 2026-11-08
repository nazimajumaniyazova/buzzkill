import { fileURLToPath } from 'node:url';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

/**
 * Runs every story as a test in Playwright's Chromium: render, play function and the a11y
 * check (#76). Separate from the unit-test project on purpose, so `pnpm test` needs no browser;
 * `pnpm test:storybook` runs this one, locally after `playwright install chromium` and in CI.
 */
export default defineConfig({
  plugins: [
    storybookTest({
      configDir: fileURLToPath(new URL('./.storybook', import.meta.url)),
      storybookScript: 'pnpm storybook',
    }),
  ],
  test: {
    name: 'storybook',
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
});
