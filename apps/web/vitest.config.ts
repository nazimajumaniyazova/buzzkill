import { jsdomProject } from '@buzzkill/config/vitest';

// The asset pipeline's tests live next to it in `scripts` and run in Node (their docblock says so).
export default jsdomProject('@buzzkill/web', {
  include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
});
