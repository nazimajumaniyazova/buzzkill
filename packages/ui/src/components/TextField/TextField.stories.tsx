import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { TextField } from './TextField';

const meta = {
  title: 'Components/TextField',
  component: TextField,
  args: {
    label: 'Nickname',
    description: '2 to 20 letters, digits, dots, dashes or underscores.',
    maxLength: 40,
    autoComplete: 'nickname',
    spellCheck: false,
    onValueChange: fn(),
  },
  parameters: { docs: { subtitle: 'A native text input with a label, a hint and an error' } },
} satisfies Meta<typeof TextField>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Tab reaches the field, typing changes it, and every change is reported. */
export const Typing: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', { name: 'Nickname' });

    await userEvent.tab();
    await expect(field).toHaveFocus();
    await userEvent.type(field, 'Bee');
    await expect(field).toHaveValue('Bee');
    await expect(args.onValueChange).toHaveBeenLastCalledWith('Bee');
  },
};

/** The error is in words, joins the description and marks the field invalid. */
export const WithError: Story = {
  args: { defaultValue: 'B', error: 'A nickname has at least 2 characters.' },
  play: async ({ canvasElement }) => {
    const field = within(canvasElement).getByRole('textbox', { name: 'Nickname' });

    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAccessibleDescription(
      '2 to 20 letters, digits, dots, dashes or underscores. A nickname has at least 2 characters.',
    );
  },
};
