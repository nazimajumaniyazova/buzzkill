import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { VisuallyHidden } from './VisuallyHidden';

const meta = {
  title: 'Primitives/VisuallyHidden',
  component: VisuallyHidden,
} satisfies Meta<typeof VisuallyHidden>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The word "Close" is read by a screen reader; sighted users see the cross. */
export const IconButtonLabel: Story = {
  name: 'Icon button label',
  render: () => (
    <button type="button">
      <span aria-hidden="true">✕</span>
      <VisuallyHidden>Close</VisuallyHidden>
    </button>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Close' });
    const label = canvas.getByText('Close');

    await expect(button).toBeVisible();
    // Clipped to one pixel, but still rendered: not display: none, not aria-hidden.
    const { width, height } = label.getBoundingClientRect();
    await expect(width).toBeLessThanOrEqual(1);
    await expect(height).toBeLessThanOrEqual(1);
    await expect(label).not.toHaveAttribute('aria-hidden');
  },
};

/** Context that the layout gives sighted users and a screen reader needs in words. */
export const InlineContext: Story = {
  name: 'Inline context',
  render: () => (
    <p style={{ margin: 0 }}>
      Score<VisuallyHidden>: </VisuallyHidden> <strong>120</strong>
    </p>
  ),
};
