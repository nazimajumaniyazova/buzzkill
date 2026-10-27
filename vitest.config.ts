import { defineConfig } from 'vitest/config';

const headlessThresholds = { lines: 80, functions: 80, branches: 80, statements: 80 };

export default defineConfig({
  test: {
    // Every package and app is a Vitest project with its own environment; see
    // packages/config/vitest for the presets. The config package has no tests.
    projects: ['packages/*', 'apps/*', '!packages/config'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['packages/*/src/**', 'apps/*/src/**'],
      exclude: [
        '**/*.stories.tsx',
        '**/*.gen.ts',
        '**/index.ts',
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
      ],
      // The engine and the simulation are pure logic and must stay well covered. The React
      // shell and the design system get thresholds once they have components (stages 4 and 5).
      thresholds: {
        'packages/engine/src/**': headlessThresholds,
        'packages/game/src/**': headlessThresholds,
      },
    },
  },
});
