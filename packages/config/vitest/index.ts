import { defineProject } from 'vitest/config';

type ProjectConfig = ReturnType<typeof defineProject>;

/**
 * Vitest project for headless packages (engine, game): Node environment, no DOM.
 * Coverage thresholds live in the root config because Vitest collects coverage globally.
 */
export function nodeProject(name: string): ProjectConfig {
  return defineProject({
    test: {
      name,
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  });
}

/**
 * Vitest project for React packages (ui, web): jsdom plus the Testing Library and axe
 * matchers registered by the shared setup module.
 */
export function jsdomProject(name: string): ProjectConfig {
  return defineProject({
    test: {
      name,
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['@buzzkill/config/vitest/setup-jsdom'],
    },
  });
}
