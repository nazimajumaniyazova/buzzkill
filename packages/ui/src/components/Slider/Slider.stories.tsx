import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, userEvent, within } from 'storybook/test';

import { Slider } from './Slider';

const percent = (value: number): string => `${String(Math.round(value * 100))} %`;

const meta = {
  title: 'Components/Slider',
  component: Slider,
  args: {
    label: 'Sound volume',
    min: 0,
    max: 1,
    step: 0.1,
    defaultValue: 0.3,
    formatValue: percent,
    onValueChange: fn(),
  },
  argTypes: { formatValue: { control: false } },
} satisfies Meta<typeof Slider>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Tab reaches the slider; the arrow keys, Home and End are the browser's own range behavior,
 * which the simulated keyboard of the test cannot drive, so the play function changes the value
 * the way a key would and checks the readout and `aria-valuetext` follow.
 */
export const Volume: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const slider = canvas.getByRole('slider', { name: 'Sound volume' });

    await userEvent.tab();
    await expect(slider).toHaveFocus();
    await fireEvent.change(slider, { target: { value: '0.4' } });
    await expect(slider).toHaveValue('0.4');
    await expect(slider).toHaveAttribute('aria-valuetext', '40 %');
    await expect(canvas.getByText('40 %')).toBeInTheDocument();
    await expect(args.onValueChange).toHaveBeenLastCalledWith(0.4);
  },
};

export const Integers: Story = {
  args: { label: 'Starting level', min: 1, max: 10, step: 1, defaultValue: 3, formatValue: String },
};

export const Night: Story = {
  globals: { theme: 'night' },
};
