import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { assetBudget } from './scripts/asset-budget';
import { buildConstants } from './scripts/game-version';

export default defineConfig({
  // The build reports the weight of the game's images and sounds and fails above their budget (#135).
  plugins: [react(), assetBudget()],
  define: buildConstants(),
});
