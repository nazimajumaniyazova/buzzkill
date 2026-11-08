import codspeedPlugin from '@codspeed/vitest-plugin';
import { configDefaults, defineProject } from 'vitest/config';

type ProjectConfig = ReturnType<typeof defineProject>;

/** The few knobs a package may turn; everything else stays the preset's decision. */
export interface ProjectOverrides {
  /** Replaces the default test file globs. */
  include?: string[];
  /** Added to Vitest's default excludes (node_modules, dist, ...). */
  exclude?: string[];
  /** Added after the preset's own setup files. */
  setupFiles?: string[];
}

/**
 * Vitest project for headless packages (engine, game): Node environment, no DOM.
 * Coverage thresholds live in the root config because Vitest collects coverage globally.
 * The CodSpeed plugin measures the `*.bench.ts` files of these packages in CI (ADR-0012);
 * anywhere else Vitest benchmarks run as usual.
 */
export function nodeProject(name: string, overrides: ProjectOverrides = {}): ProjectConfig {
  return defineProject({
    plugins: [codspeedPlugin()],
    test: {
      name,
      environment: 'node',
      include: overrides.include ?? ['src/**/*.test.ts'],
      exclude: [...configDefaults.exclude, ...(overrides.exclude ?? [])],
      setupFiles: overrides.setupFiles ?? [],
    },
  });
}

/**
 * Vitest project for React packages (ui, web) and other DOM-bound code: jsdom plus the Testing
 * Library and axe matchers registered by the shared setup module.
 */
export function jsdomProject(name: string, overrides: ProjectOverrides = {}): ProjectConfig {
  return defineProject({
    test: {
      name,
      environment: 'jsdom',
      include: overrides.include ?? ['src/**/*.test.{ts,tsx}'],
      exclude: [...configDefaults.exclude, ...(overrides.exclude ?? [])],
      setupFiles: ['@buzzkill/config/vitest/setup-jsdom', ...(overrides.setupFiles ?? [])],
      // Testing Library registers its automatic DOM cleanup only when `afterEach` is a global;
      // without it, renders pile up across the tests of a file. Tests still import from vitest.
      globals: true,
      // CSS Modules keep their class names as written (`styles.stack === 'stack'`), so a test
      // can assert them; other stylesheets are not processed.
      css: { include: [/.module.css$/], modules: { classNameStrategy: 'non-scoped' } },
    },
  });
}
