import { fixupConfigRules } from '@eslint/compat';
import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { importX } from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import testingLibrary from 'eslint-plugin-testing-library';
import globals from 'globals';
import { configs as tsConfigs } from 'typescript-eslint';

const reactFiles = ['apps/web/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'];

export default defineConfig([
  globalIgnores(['**/dist', '**/coverage', '**/.turbo', '**/storybook-static', '**/*.gen.ts']),

  js.configs.recommended,
  tsConfigs.strictTypeChecked,
  tsConfigs.stylisticTypeChecked,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    settings: {
      // Resolves workspace packages through their `exports` to TypeScript source.
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: ['tsconfig.json', 'apps/*/tsconfig.json', 'packages/*/tsconfig.json'],
          noWarnOnMultipleProjects: true,
        }),
      ],
    },
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'import-x/no-cycle': 'error',
      'import-x/no-default-export': 'error',
      'import-x/no-extraneous-dependencies': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]',
          message: 'Do not assign HTML strings. Use DOM APIs or JSX.',
        },
        {
          selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
          message: 'Do not insert HTML strings.',
        },
        {
          selector: 'TSEnumDeclaration',
          message: 'Use union types or `as const` objects instead of enums.',
        },
      ],
    },
  },

  // Tool configuration files are plain JavaScript outside every tsconfig: lint them
  // without type information and with Node globals. Default exports are their contract.
  {
    files: ['**/*.{js,cjs,mjs}'],
    extends: [tsConfigs.disableTypeChecked],
    languageOptions: { globals: globals.node },
    rules: {
      // JavaScript cannot carry type annotations; JSDoc documents the shapes instead.
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
  },
  {
    files: ['**/*.config.{js,cjs,mjs,ts}'],
    rules: { 'import-x/no-default-export': 'off' },
  },

  // game: no DOM globals and no non-deterministic APIs, so the simulation stays headless
  // and reproducible across JavaScript engines (ADR-0009, stage 3).
  {
    files: ['packages/game/src/**/*.ts'],
    ignores: ['**/*.test.ts', '**/*.bench.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'sessionStorage',
        'fetch',
        'navigator',
        'performance',
        'requestAnimationFrame',
      ],
      'no-restricted-properties': [
        'error',
        ...['random', 'sin', 'cos', 'tan', 'atan', 'atan2', 'exp', 'log', 'pow', 'hypot'].map(
          (property) => ({
            object: 'Math',
            property,
            message:
              'Non-deterministic across JS engines. Use @buzzkill/engine/math or the seeded RNG.',
          }),
        ),
        { object: 'Date', property: 'now', message: 'Simulation time is the tick counter.' },
      ],
    },
  },

  // The 2023 engine imported from the team project (packages/game/src/legacy). It is DOM-bound
  // and predates the standards above, so until #42 replaces it, it is linted without type
  // information and without the headless rules of the game package.
  {
    files: ['packages/game/src/legacy/**/*.ts'],
    extends: [tsConfigs.disableTypeChecked],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },

  // React shell and design system. `extends` scopes each shared config to these files and
  // merges their rules instead of letting one object spread overwrite another.
  // eslint-plugin-react and eslint-plugin-jsx-a11y still call context APIs that ESLint 10
  // removed (`context.getFilename`), so their rules run through the official compat shim.
  {
    files: reactFiles,
    extends: [
      ...fixupConfigRules([react.configs.flat.recommended, react.configs.flat['jsx-runtime']]),
      reactHooks.configs.flat.recommended,
      ...fixupConfigRules(jsxA11y.flatConfigs.strict),
    ],
    languageOptions: { globals: globals.browser },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/no-danger': 'error',
      'react/jsx-no-useless-fragment': 'error',
    },
  },

  // Tests: Vitest rules everywhere, Testing Library rules where components are rendered.
  {
    files: ['**/*.test.{ts,tsx}'],
    extends: [vitest.configs.recommended],
    rules: {
      // Property-based tests from @fast-check/vitest are declared as test.prop([...])(name, fn).
      'vitest/no-standalone-expect': [
        'error',
        { additionalTestBlockFunctions: ['test.prop', 'it.prop'] },
      ],
    },
  },
  {
    files: ['**/*.test.tsx'],
    extends: [testingLibrary.configs['flat/react']],
  },

  prettier, // always last: turns off formatting rules that Prettier owns
]);
