/**
 * Architecture rules between workspace packages. Package manifests already stop undeclared
 * imports (pnpm); these rules stop declared-but-forbidden directions and structural smells.
 * Run: pnpm exec depcruise apps packages
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'Circular dependencies make modules impossible to reason about or test alone. ' +
        'Cycles made only of type imports do not exist at runtime and are allowed.',
      from: {},
      to: { circular: true, viaOnly: { dependencyTypesNot: ['type-only'] } },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      comment: 'An import that cannot be resolved is a typo or a missing dependency.',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'engine-is-standalone',
      severity: 'error',
      comment: 'The engine knows nothing about the game, the design system, the app or React.',
      from: { path: '^packages/engine/' },
      to: { path: '^(packages/(game|ui)|apps)/|node_modules/react(-dom)?/' },
    },
    {
      name: 'engine-core-is-headless',
      severity: 'error',
      comment:
        'The main engine entry compiles without the DOM lib so the game and the server can use ' +
        'it; only src/browser may touch the DOM, and nothing outside it imports it.',
      from: { path: '^packages/engine/src/(?!browser/)' },
      to: { path: '^packages/engine/src/browser/' },
    },
    {
      name: 'game-depends-only-on-engine',
      severity: 'error',
      comment: 'The game domain depends on the engine only; it never imports UI, the app or React.',
      from: { path: '^packages/game/' },
      to: { path: '^(packages/ui|apps)/|node_modules/react(-dom)?/' },
    },
    {
      name: 'ui-knows-nothing-about-game',
      severity: 'error',
      comment: 'The design system is reusable: no imports from engine, game or the app.',
      from: { path: '^packages/ui/' },
      to: { path: '^(packages/(engine|game)|apps)/' },
    },
    {
      name: 'no-deep-imports',
      severity: 'error',
      comment: 'Other packages are used only through their public entry (src/index.ts).',
      from: { path: '^(apps|packages)/([^/]+)/' },
      // The declared subpath exports: the engine's browser entry and the tokens stylesheet.
      to: {
        path: '^packages/(?!$2/)[^/]+/src/(?!index\\.ts$)(?!browser/index\\.ts$)(?!tokens/tokens\\.css$)',
      },
    },
    {
      name: 'not-to-test',
      severity: 'error',
      comment: 'Production code must not import tests, stories or test utilities.',
      from: { pathNot: '\\.(test|spec|bench)\\.[jt]sx?$|\\.stories\\.tsx?$|test-utils' },
      to: { path: '\\.(test|spec|bench)\\.[jt]sx?$|\\.stories\\.tsx?$|test-utils' },
    },
    {
      name: 'no-orphans',
      severity: 'error',
      comment:
        'A module nobody imports and that imports nothing is dead code or a forgotten entry.',
      from: {
        orphan: true,
        pathNot: [
          '\\.d\\.ts$',
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$',
          '\\.config\\.[jt]s$',
          '/src/index\\.ts$',
          // Tests, benchmarks and their setup files are entry points: nothing imports them by design.
          '\\.(test|bench)\\.[jt]sx?$',
          '/__tests__/',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules'] },
    exclude: {
      path: ['(^|/)(dist|coverage|storybook-static|\\.turbo)/'],
    },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.css'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
