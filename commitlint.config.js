const AI_ATTRIBUTION = /co-authored-by:\s*claude|claude-session:|generated with \[?claude code/i;

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'no-ai-attribution': ({ raw }) => [
          !AI_ATTRIBUTION.test(raw ?? ''),
          'AI attribution lines (Co-Authored-By: Claude, Claude-Session, Generated with Claude Code) are not allowed',
        ],
      },
    },
  ],
  rules: {
    'header-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100],
    'scope-enum': [
      2,
      'always',
      ['engine', 'game', 'ui', 'web', 'config', 'deps', 'repo', 'release'],
    ],
    'no-ai-attribution': [2, 'always'],
  },
};
