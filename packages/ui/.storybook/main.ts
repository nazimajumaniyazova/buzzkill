import type { StorybookConfig } from '@storybook/react-vite';
import type { InlineConfig } from 'vite';

/**
 * Storybook of the design system (#76): the tokens and the themes now, every component and its
 * states from #78 on. The a11y addon checks every story; the Vitest addon runs every story as a
 * test in Chromium (`pnpm test:storybook`).
 */
const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest'],
  core: { disableTelemetry: true },
  // The package has no vite.config, and the builder does not add the React plugin on its own.
  async viteFinal(viteConfig: InlineConfig): Promise<InlineConfig> {
    const [{ mergeConfig }, { default: react }] = await Promise.all([
      import('vite'),
      import('@vitejs/plugin-react'),
    ]);
    return mergeConfig(viteConfig, { plugins: [react()] });
  },
};

export default config;
