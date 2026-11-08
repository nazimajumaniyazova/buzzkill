import { fileURLToPath } from 'node:url';

/** The generated token stylesheet: the only custom properties a `var()` may name (ADR-0005). */
const tokensCss = fileURLToPath(new URL('./packages/ui/src/tokens/tokens.css', import.meta.url));

/** @type {import('stylelint').Config} */
export default {
  extends: [
    'stylelint-config-standard',
    'stylelint-config-css-modules',
    '@css-modules-kit/stylelint-plugin/recommended',
  ],
  plugins: ['stylelint-declaration-strict-value', 'stylelint-value-no-unknown-custom-properties'],
  rules: {
    // Outside the token files, colors and spacing may only come from design tokens (var(--…)).
    'color-no-hex': true,
    'scale-unlimited/declaration-strict-value': [
      [
        '/color$/',
        'background-color',
        'fill',
        'stroke',
        'gap',
        '/^padding/',
        '/^margin/',
        'border-radius',
        'z-index',
      ],
      { ignoreValues: ['transparent', 'currentColor', 'inherit', 'initial', 'unset', '0', 'auto'] },
    ],
    // A var() must name a token of the generated stylesheet or a property declared in the file.
    'csstools/value-no-unknown-custom-properties': [true, { importFrom: [tokensCss] }],
  },
  overrides: [
    {
      files: ['packages/ui/src/tokens/**/*.css'],
      rules: { 'color-no-hex': null, 'scale-unlimited/declaration-strict-value': null },
    },
    {
      // A CSS Modules class is the key TypeScript uses (`styles.keyHint`), with no case
      // conversion (ADR-0005), so it is camelCase like the key.
      files: ['**/*.module.css'],
      rules: {
        'selector-class-pattern': [
          '^[a-z][a-zA-Z0-9]*$',
          { message: 'Expected class name to be camelCase, the key used from TypeScript' },
        ],
      },
    },
  ],
};
