import { jsdomProject } from '@buzzkill/config/vitest';

// Characterization tests of the imported 2023 engine. It uses Image, Audio and window listeners,
// so it runs in jsdom with the media and canvas stubs from the local setup file. Removed in #42.
export default jsdomProject('@buzzkill/game (legacy)', {
  include: ['src/legacy/__tests__/**/*.test.ts'],
  setupFiles: ['./src/legacy/__tests__/setup.ts'],
});
