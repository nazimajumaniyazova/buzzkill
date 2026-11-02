import { nodeProject } from '@buzzkill/config/vitest';

// The legacy folder is DOM-bound and has its own jsdom project (vitest.legacy.config.ts).
export default nodeProject('@buzzkill/game', { exclude: ['src/legacy/**'] });
