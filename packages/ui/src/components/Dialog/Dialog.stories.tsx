import type { Meta, StoryObj } from '@storybook/react-vite';
import { type JSX, useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';

import { Button } from '../Button/Button';
import { Inline } from '../Inline/Inline';
import { Dialog, type DialogProps } from './Dialog';

type DemoProps = Omit<DialogProps, 'open' | 'onClose' | 'children'>;

/** A page with an opener and the dialog, the way the shell will use it. */
function Demo(props: DemoProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const close = (): void => {
    setOpen(false);
  };
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        Pause
      </Button>
      <Dialog {...props} open={open} onClose={close}>
        <Inline>
          <Button onClick={close}>Resume</Button>
          <Button variant="secondary" onClick={close}>
            Quit to menu
          </Button>
        </Inline>
      </Dialog>
    </>
  );
}

const meta = {
  title: 'Components/Dialog',
  component: Demo,
  args: {
    title: 'Paused',
    closeLabel: 'Close',
  },
  parameters: {
    docs: { subtitle: 'WAI-ARIA pattern: Dialog (Modal), on the native dialog element' },
  },
} satisfies Meta<typeof Demo>;

export default meta;

type Story = StoryObj<typeof meta>;

const DESCRIPTION = 'The run waits for you. Escape or Resume continues it.';

/** Opens the dialog from the Pause button and checks the pattern and the initial focus. */
const openAndCheck: NonNullable<Story['play']> = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Pause' }));

  const dialog = await canvas.findByRole('dialog', { name: 'Paused' });
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(canvas.getByRole('button', { name: 'Resume' })).toHaveFocus();
};

/** Opens on the Pause button; the first control inside takes focus. */
export const Default: Story = {
  args: { description: DESCRIPTION },
  play: openAndCheck,
};

/** Tab cycles inside the open dialog; Escape closes it and returns focus to the opener. */
export const FocusTrapAndEscape: Story = {
  name: 'Focus trap and Escape',
  args: { description: DESCRIPTION },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const opener = canvas.getByRole('button', { name: 'Pause' });
    await userEvent.click(opener);
    const dialog = await canvas.findByRole('dialog', { name: 'Paused' });

    // The page behind a native modal is inert: Tab may visit the browser's own UI (focus on
    // `body` for a moment) but never the opener or anything else on the page.
    for (let press = 0; press < 5; press += 1) {
      await userEvent.tab();
      const active = document.activeElement;
      await expect(active === document.body || dialog.contains(active)).toBe(true);
      await expect(opener).not.toHaveFocus();
    }

    await userEvent.keyboard('{Escape}');
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument();
    await expect(opener).toHaveFocus();
  },
};

export const WithoutDescription: Story = {
  name: 'Without a description',
  play: openAndCheck,
};

export const Night: Story = {
  globals: { theme: 'night' },
  args: { description: DESCRIPTION },
  play: openAndCheck,
};
