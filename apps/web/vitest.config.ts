import { jsdomProject } from '@buzzkill/config/vitest';

import { buildConstants } from './scripts/game-version';

// The asset pipeline's tests live next to it in `scripts` and run in Node (their docblock says so).
// Vitest reads this file instead of vite.config.ts, so the build's constants are repeated here.
export default jsdomProject('@buzzkill/web', {
  include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  define: buildConstants(),
});
