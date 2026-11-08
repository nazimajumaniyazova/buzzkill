import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { KeyHint } from './KeyHint';

const meta = {
  title: 'Primitives/KeyHint',
  component: KeyHint,
  args: { children: 'Space', kind: 'key' },
  argTypes: {
    kind: { control: 'inline-radio', options: ['key', 'gamepad'] },
  },
} satisfies Meta<typeof KeyHint>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Key: Story = {};

/** The arrow is printed; "Arrow up" is what a screen reader says. */
export const WithSymbol: Story = {
  name: 'With a symbol',
  args: { children: 'Arrow up', symbol: '↑' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('↑')).toHaveAttribute('aria-hidden', 'true');
    await expect(canvas.getByText('Arrow up')).toBeInTheDocument();
  },
};

export const GamepadButton: Story = {
  name: 'Gamepad button',
  args: { children: 'Button A', symbol: 'A', kind: 'gamepad' },
};

/** The controls help of the start screen. */
export const ControlsHelp: Story = {
  name: 'Controls help',
  render: () => (
    <p style={{ margin: 0 }}>
      <KeyHint symbol="↑">Arrow up</KeyHint> and <KeyHint symbol="↓">Arrow down</KeyHint> to move,{' '}
      <KeyHint>Space</KeyHint> to shoot, <KeyHint>Escape</KeyHint> to pause. On a gamepad,{' '}
      <KeyHint kind="gamepad" symbol="A">
        Button A
      </KeyHint>{' '}
      shoots.
    </p>
  ),
};
