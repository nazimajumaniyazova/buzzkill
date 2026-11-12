import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { assetBudget } from './scripts/asset-budget';

export default defineConfig({
  // The build reports the weight of the game's images and sounds and fails above their budget (#135).
  plugins: [react(), assetBudget()],
});
