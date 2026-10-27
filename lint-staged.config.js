export default {
  '*.{ts,tsx,js,cjs,mjs}': [
    'eslint --fix --max-warnings=0',
    'prettier --write',
    'cspell --no-must-find-files --no-progress',
  ],
  '*.css': ['stylelint --fix', 'prettier --write'],
  '*.{json,jsonc,md,yml,yaml,html}': ['prettier --write'],
  '*.md': ['cspell --no-must-find-files --no-progress'],
};
