import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { Inline } from '../Inline/Inline';
import { Button } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  args: {
    children: 'Play',
    variant: 'primary',
    size: 'md',
    disabled: false,
    loading: false,
    onClick: fn(),
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'danger'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    type: { control: 'inline-radio', options: ['button', 'submit', 'reset'] },
  },
  parameters: { docs: { subtitle: 'WAI-ARIA pattern: Button, on the native button element' } },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Quit to menu' },
};

export const Danger: Story = {
  args: { variant: 'danger', children: 'Delete replay' },
};

export const Sizes: Story = {
  render: (args) => (
    <Inline align="center">
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
    </Inline>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
};

/** The label stays, a spinner joins it, and the button keeps focus but ignores activation. */
export const Loading: Story = {
  args: { loading: true, children: 'Saving' },
};

/** Tab reaches the button, Enter activates it. */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Play' });

    await userEvent.tab();
    await expect(button).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

/** Every variant and state in the night theme, so the a11y check covers both themes. */
export const Night: Story = {
  globals: { theme: 'night' },
  render: (args) => (
    <Inline>
      <Button {...args}>Primary</Button>
      <Button {...args} variant="secondary">
        Secondary
      </Button>
      <Button {...args} variant="danger">
        Danger
      </Button>
      <Button {...args} disabled>
        Disabled
      </Button>
      <Button {...args} loading>
        Loading
      </Button>
    </Inline>
  ),
};
