import type { Meta, StoryObj } from '@storybook/react-vite';
import type { JSX } from 'react';
import { expect, userEvent, within } from 'storybook/test';

import { Button } from '../Button/Button';
import { Inline } from '../Inline/Inline';
import { ToastProvider, type ToastProviderProps } from './ToastProvider';
import { useToast } from './use-toast';

function Triggers(): JSX.Element {
  const toast = useToast();
  return (
    <Inline>
      <Button
        variant="secondary"
        onClick={() => {
          toast.show({ title: 'Replay saved', description: 'replay-2026-11-09.json, 12 kB' });
        }}
      >
        Save replay
      </Button>
      <Button
        onClick={() => {
          toast.show({ title: 'New high score', tone: 'success' });
        }}
      >
        Finish a run
      </Button>
      <Button
        variant="danger"
        onClick={() => {
          toast.show({
            title: 'Could not reach the leaderboard',
            description: 'The score is kept and sent later.',
            tone: 'danger',
            duration: null,
          });
        }}
      >
        Lose the network
      </Button>
    </Inline>
  );
}

/** A page with buttons that show toasts of each tone; the danger one stays until dismissed. */
function Demo(props: Omit<ToastProviderProps, 'children'>): JSX.Element {
  return (
    <ToastProvider {...props}>
      <Triggers />
    </ToastProvider>
  );
}

const meta = {
  title: 'Components/Toast',
  component: Demo,
  args: { label: 'Notifications', duration: 5000 },
  parameters: {
    docs: { subtitle: 'WAI-ARIA pattern: Alert for danger; the status live region for the rest' },
  },
} satisfies Meta<typeof Demo>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Shows a toast, checks the announcement and that focus stayed, then dismisses it. */
const showAndDismiss: NonNullable<Story['play']> = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const trigger = canvas.getByRole('button', { name: 'Save replay' });

  await userEvent.click(trigger);

  const region = canvas.getByRole('list', { name: 'Notifications' });
  await expect(region).toHaveTextContent('Replay saved');
  await expect(canvas.getByRole('status')).toHaveTextContent('Replay saved');
  await expect(trigger).toHaveFocus();

  await userEvent.click(canvas.getByRole('button', { name: 'Dismiss' }));
  await expect(canvas.queryByText('Replay saved')).not.toBeInTheDocument();
};

/** A toast appears in the corner, is announced, and focus stays on the button. */
export const Default: Story = {
  play: showAndDismiss,
};

export const Night: Story = {
  globals: { theme: 'night' },
  play: showAndDismiss,
};
