import { nodeProject } from '@buzzkill/config/vitest';

export default nodeProject('@buzzkill/server', {
  include: ['src/**/*.test.ts', 'function/**/*.test.ts'],
});
