import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';

import { Inline } from './Inline';

/** A 200 px wide frame, so the row has to wrap. */
const narrow: Decorator = (Story) => (
  <div style={{ width: 200, outline: '1px dashed var(--color-border)' }}>
    <Story />
  </div>
);

const chip = {
  padding: 'var(--space-inset-sm)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--color-surface)',
};

const meta = {
  title: 'Primitives/Inline',
  component: Inline,
  args: {
    gap: 'md',
    align: 'center',
    justify: 'start',
    children: (
      <>
        <span style={chip}>Arrow keys</span>
        <span style={chip}>Space</span>
        <span style={{ ...chip, fontSize: 'var(--font-size-lg)' }}>Escape</span>
        <span style={chip}>Gamepad</span>
      </>
    ),
  },
  argTypes: {
    gap: { control: 'inline-radio', options: ['sm', 'md', 'lg', 'xl'] },
    align: { control: 'inline-radio', options: ['start', 'center', 'end', 'baseline'] },
    justify: { control: 'inline-radio', options: ['start', 'center', 'end', 'between'] },
  },
  parameters: { docs: { subtitle: 'No WAI-ARIA pattern: layout only, without a role' } },
} satisfies Meta<typeof Inline>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SpaceBetween: Story = {
  name: 'Space between',
  args: { justify: 'between' },
};

/** The row wraps when the width runs out; nothing is clipped. */
export const Wrapping: Story = {
  args: { gap: 'sm' },
  decorators: [narrow],
};
