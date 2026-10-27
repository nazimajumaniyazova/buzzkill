/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard', 'stylelint-config-css-modules'],
  plugins: ['stylelint-declaration-strict-value'],
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
  },
  overrides: [
    {
      files: ['packages/ui/src/tokens/**/*.css'],
      rules: { 'color-no-hex': null, 'scale-unlimited/declaration-strict-value': null },
    },
  ],
};
