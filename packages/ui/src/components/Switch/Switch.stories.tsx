import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { Stack } from '../Stack/Stack';
import { Switch } from './Switch';

const meta = {
  title: 'Components/Switch',
  component: Switch,
  args: { label: 'Sound effects', disabled: false, onCheckedChange: fn() },
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Space toggles the focused switch. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const control = canvas.getByRole('switch', { name: 'Sound effects' });

    await userEvent.tab();
    await expect(control).toHaveFocus();
    await userEvent.keyboard(' ');
    await expect(control).toHaveAttribute('aria-checked', 'true');
    await expect(args.onCheckedChange).toHaveBeenLastCalledWith(true);
  },
};

export const On: Story = {
  args: { defaultChecked: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const Night: Story = {
  globals: { theme: 'night' },
  render: (args) => (
    <Stack align="start">
      <Switch {...args} />
      <Switch {...args} label="Music" defaultChecked />
      <Switch {...args} label="Vibration" disabled />
    </Stack>
  ),
};
