import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { RadioGroup } from './RadioGroup';

const meta = {
  title: 'Components/RadioGroup',
  component: RadioGroup,
  args: {
    label: 'Hero',
    name: 'hero',
    options: [
      { value: 'male', label: 'Mike' },
      { value: 'female', label: 'Julie' },
    ],
    defaultValue: 'male',
    orientation: 'horizontal',
    onValueChange: fn(),
  },
  argTypes: {
    orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] },
  },
  parameters: {
    docs: { subtitle: 'WAI-ARIA pattern: Radio Group, on native radio inputs in a fieldset' },
  },
} satisfies Meta<typeof RadioGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Tab reaches the chosen option; the arrow keys move and choose inside the group. */
export const Hero: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await userEvent.tab();
    await expect(canvas.getByRole('radio', { name: 'Mike' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('radio', { name: 'Julie' })).toBeChecked();
    await expect(args.onValueChange).toHaveBeenLastCalledWith('female');
  },
};

export const TimeOfDay: Story = {
  name: 'Time of day',
  args: {
    label: 'Time of day',
    name: 'mode',
    options: [
      { value: 'day', label: 'Day' },
      { value: 'night', label: 'Night' },
    ],
    defaultValue: 'day',
  },
};

export const Vertical: Story = {
  args: {
    label: 'Theme',
    name: 'theme',
    options: [
      { value: 'system', label: 'Match the system' },
      { value: 'day', label: 'Always day' },
      { value: 'night', label: 'Always night' },
    ],
    defaultValue: 'system',
    orientation: 'vertical',
  },
};

export const Night: Story = {
  globals: { theme: 'night' },
};
