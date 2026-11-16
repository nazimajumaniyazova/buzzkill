import { env } from 'node:process';

import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const inCi = env['CI'] !== undefined;

/**
 * End-to-end tests of the built app (#153), run with `pnpm test:e2e`. The web server builds the
 * app and serves it with `vite preview`, as players get it: the bundle, the atlases and the
 * budgets, not the dev server.
 *
 * Both projects are Chromium, the one browser CI already installs for the Storybook tests: a Pixel
 * 7, with a touch screen whose primary pointer is coarse, and a desktop with a mouse. The touch
 * gestures go through the Chrome DevTools Protocol, which is Chromium's alone; WebKit and the
 * iPhone are for the end-to-end stage of the plan.
 */
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: inCi,
  retries: inCi ? 2 : 0,
  reporter: inCi ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: 'on-first-retry',
  },
  // Each project runs the tests tagged for its pointer.
  projects: [
    { name: 'Pixel 7', use: { ...devices['Pixel 7'] }, grep: /@touch/ },
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] }, grep: /@mouse/ },
  ],
  webServer: {
    command: `pnpm build && pnpm preview --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: !inCi,
    timeout: 180_000,
  },
});
