import { nodeProject } from './vitest/index';

// The build helpers run in Node; the Vitest presets themselves are tested by every other project.
export default nodeProject('@buzzkill/config', { include: ['game-version/**/*.test.ts'] });
