import type { Meta, StoryObj } from '@storybook/react-vite';

import { Stack } from './Stack';

const box = {
  padding: 'var(--space-inset-sm)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-control)',
  background: 'var(--color-surface)',
};

const meta = {
  title: 'Primitives/Stack',
  component: Stack,
  args: {
    gap: 'md',
    align: 'stretch',
    children: (
      <>
        <div style={box}>First</div>
        <div style={{ ...box, width: '60%' }}>Second, narrower</div>
        <div style={box}>Third</div>
      </>
    ),
  },
  argTypes: {
    gap: { control: 'inline-radio', options: ['sm', 'md', 'lg', 'xl'] },
    align: { control: 'inline-radio', options: ['start', 'center', 'end', 'stretch'] },
  },
  parameters: { docs: { subtitle: 'No WAI-ARIA pattern: layout only, without a role' } },
} satisfies Meta<typeof Stack>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Centered: Story = {
  args: { align: 'center', gap: 'lg' },
};

export const Tight: Story = {
  args: { gap: 'sm' },
};
