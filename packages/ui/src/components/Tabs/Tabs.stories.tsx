import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { Tabs } from './Tabs';

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  args: {
    label: 'Settings',
    activation: 'automatic',
    onValueChange: fn(),
    items: [
      { value: 'controls', label: 'Controls', panel: <p>Arrow keys move, Space shoots.</p> },
      { value: 'audio', label: 'Audio', panel: <p>Sound effects at 30 %.</p> },
      { value: 'display', label: 'Display', panel: <p>Theme follows the system.</p> },
      { value: 'cheats', label: 'Cheats', panel: <p>There are none.</p>, disabled: true },
    ],
  },
  argTypes: {
    activation: { control: 'inline-radio', options: ['automatic', 'manual'] },
  },
  parameters: { docs: { subtitle: 'WAI-ARIA pattern: Tabs' } },
} satisfies Meta<typeof Tabs>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Automatic activation: the arrow keys select the tab they move to. */
export const Automatic: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await userEvent.tab();
    await expect(canvas.getByRole('tab', { name: 'Controls' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: 'Audio' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(canvas.getByRole('tabpanel', { name: 'Audio' })).toBeVisible();
    await expect(args.onValueChange).toHaveBeenLastCalledWith('audio');
  },
};

/** Manual activation: the arrow keys only move focus; Enter or Space selects. */
export const Manual: Story = {
  args: { activation: 'manual' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: 'Audio' })).toHaveFocus();
    await expect(canvas.getByRole('tab', { name: 'Controls' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('tab', { name: 'Audio' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(args.onValueChange).toHaveBeenLastCalledWith('audio');
  },
};

export const Night: Story = {
  globals: { theme: 'night' },
  args: { defaultValue: 'display' },
};
