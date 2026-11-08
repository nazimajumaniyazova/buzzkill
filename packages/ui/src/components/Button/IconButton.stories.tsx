import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { Inline } from '../Inline/Inline';
import { IconButton } from './IconButton';

const meta = {
  title: 'Components/IconButton',
  component: IconButton,
  args: {
    label: 'Close',
    children: '✕',
    variant: 'secondary',
    size: 'md',
    disabled: false,
    loading: false,
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'danger'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof IconButton>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The label is the accessible name and the tooltip; the icon is hidden from screen readers. */
export const Close: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Close' });

    await expect(button).toHaveAttribute('title', 'Close');
    await expect(canvas.getByText('✕')).toHaveAttribute('aria-hidden', 'true');
  },
};

export const Sizes: Story = {
  render: (args) => (
    <Inline align="center">
      <IconButton {...args} size="sm" />
      <IconButton {...args} size="md" />
      <IconButton {...args} size="lg" />
    </Inline>
  ),
};

const renderVariants: NonNullable<Story['render']> = (args) => (
  <Inline>
    <IconButton {...args} variant="primary" label="Play">
      ▶
    </IconButton>
    <IconButton {...args} variant="secondary" label="Pause">
      ❚❚
    </IconButton>
    <IconButton {...args} variant="danger" label="Delete">
      🗑
    </IconButton>
    <IconButton {...args} loading label="Saving">
      ✓
    </IconButton>
  </Inline>
);

export const Variants: Story = {
  render: renderVariants,
};

export const Night: Story = {
  globals: { theme: 'night' },
  render: renderVariants,
};
