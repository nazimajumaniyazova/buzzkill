import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { Menu } from './Menu';
import { MenuItem } from './MenuItem';

const meta = {
  title: 'Components/Menu',
  component: Menu,
  subcomponents: { MenuItem },
  args: {
    label: 'Options',
    variant: 'secondary',
    size: 'md',
    onOpenChange: fn(),
    children: (
      <>
        <MenuItem onSelect={fn()}>Resume</MenuItem>
        <MenuItem onSelect={fn()}>Restart</MenuItem>
        <MenuItem onSelect={fn()} disabled>
          Save replay
        </MenuItem>
        <MenuItem onSelect={fn()}>Quit to menu</MenuItem>
      </>
    ),
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'danger'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof Menu>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Opened from the keyboard: ArrowDown focuses the first item, arrows move, Escape closes. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Options' });

    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(canvas.getByRole('menu', { name: 'Options' })).toBeInTheDocument();
    await expect(canvas.getByRole('menuitem', { name: 'Resume' })).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expect(canvas.getByRole('menuitem', { name: 'Save replay' })).toHaveFocus();
    await userEvent.keyboard('q');
    await expect(canvas.getByRole('menuitem', { name: 'Quit to menu' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    await expect(canvas.queryByRole('menu')).not.toBeInTheDocument();
    await expect(trigger).toHaveFocus();
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};

/** Open from the start, for the docs and the a11y check of the list. */
export const Open: Story = {
  args: { defaultOpen: true },
};

export const Night: Story = {
  globals: { theme: 'night' },
  args: { defaultOpen: true },
};
