import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { assetBudget } from './scripts/asset-budget';
import { contentSecurityPolicyPlugin } from './scripts/content-security-policy';
import { buildConstants } from './scripts/game-version';

export default defineConfig({
  // The build reports the weight of the game's images and sounds and fails above their budget (#135),
  // and writes the page's content security policy (ADR-0019, amendment of 2026-11-25).
  plugins: [react(), assetBudget(), contentSecurityPolicyPlugin()],
  define: buildConstants(),
});
