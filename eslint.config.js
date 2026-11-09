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
import { configs as storybookConfigs } from 'eslint-plugin-storybook';
import testingLibrary from 'eslint-plugin-testing-library';
import globals from 'globals';
import { configs as tsConfigs } from 'typescript-eslint';

const reactFiles = ['apps/web/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'];

const restrictedSyntax = [
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
];

// Text for the player outside the dictionary (ADR-0013): a string in a prop or a field that
// reaches the player, or in a condition between tags. `react/jsx-no-literals` covers the rest of
// the text between tags. A string literal is the one whose source starts with a quote.
const userFacingProps =
  '/^(alt|aria-description|aria-label|aria-valuetext|closeLabel|description|label|placeholder|title)$/';
const text = `:matches(Literal[raw=/^['"]/], TemplateLiteral)`;
const dictionaryMessage =
  'Text for the player comes from the dictionary (ADR-0013): use useI18n().';
const userFacingStrings = [
  `JSXAttribute[name.name=${userFacingProps}] > ${text}`,
  `JSXAttribute[name.name=${userFacingProps}] > JSXExpressionContainer > ${text}`,
  `Property[key.name=/^(description|label|title)$/] > ${text}`,
  `:matches(JSXElement, JSXFragment) > JSXExpressionContainer > :matches(ConditionalExpression, LogicalExpression) > Literal[raw=/^['"]/]`,
].map((selector) => ({ selector, message: dictionaryMessage }));

export default defineConfig([
  globalIgnores([
    '**/dist',
    '**/coverage',
    '**/.turbo',
    '**/storybook-static',
    '**/*.gen.ts',
    '**/*.module.css.d.ts',
  ]),

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
      // The workspace bans the `!` non-null assertion (CLAUDE.md); an `as` assertion next to a
      // comment that states the invariant is the accepted form, and this rule would demand `!`.
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'import-x/no-cycle': 'error',
      'import-x/no-default-export': 'error',
      'import-x/no-extraneous-dependencies': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'no-restricted-syntax': ['error', ...restrictedSyntax],
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

  // Storybook: its rules for stories and the preview, and the default exports that CSF requires.
  ...storybookConfigs['flat/recommended'],
  {
    files: ['**/*.stories.tsx', '**/.storybook/**'],
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
      // The strict preset drops the rule's own allowance; the WAI-ARIA tabs pattern puts a
      // tabpanel in the Tab order so its content is reachable when it holds no control.
      'jsx-a11y/no-noninteractive-tabindex': ['error', { roles: ['tabpanel'] }],
    },
  },

  // The shell speaks through its dictionary (ADR-0013): no text for the player in the code of
  // the screens. The dictionaries are where the text lives; tests query by it.
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', 'apps/web/src/i18n/en.ts', 'apps/web/src/i18n/ru.ts'],
    rules: {
      'react/jsx-no-literals': ['error', { noStrings: true, ignoreProps: true }],
      'no-restricted-syntax': ['error', ...restrictedSyntax, ...userFacingStrings],
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
