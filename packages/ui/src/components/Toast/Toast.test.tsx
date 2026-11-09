import { render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { Button } from '../Button/Button';
import type { ToastOptions } from './toast-context';
import { ToastProvider } from './ToastProvider';
import { useToast } from './use-toast';

/** Short enough for real timers in a test, long enough to tell "paused" from "slow". */
const DURATION = 80;

function Notifier({ options }: { readonly options: ToastOptions }): JSX.Element {
  const toast = useToast();
  return (
    <Button
      onClick={() => {
        toast.show(options);
      }}
    >
      Notify
    </Button>
  );
}

function Page({
  options = { title: 'Replay saved', description: '12 kB' },
  duration = DURATION,
}: {
  readonly options?: ToastOptions;
  readonly duration?: number | null;
}): JSX.Element {
  return (
    <ToastProvider duration={duration}>
      <Notifier options={options} />
      <Button variant="secondary">Elsewhere</Button>
    </ToastProvider>
  );
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const gone = (text: string): Promise<void> =>
  waitFor(() => {
    expect(screen.queryByText(text)).not.toBeInTheDocument();
  });

describe('Toast', () => {
  it('shows the toast in the notification region, announces it politely and keeps focus', async () => {
    const user = userEvent.setup();
    render(<Page duration={null} />);

    await user.click(screen.getByRole('button', { name: 'Notify' }));

    const region = screen.getByRole('list', { name: 'Notifications' });
    expect(region).toHaveTextContent('Replay saved');
    expect(region).toHaveTextContent('12 kB');
    expect(screen.getByRole('status')).toHaveTextContent('Replay saved. 12 kB');
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
    expect(screen.getByRole('button', { name: 'Notify' })).toHaveFocus();
  });

  it('announces a danger toast assertively', async () => {
    const user = userEvent.setup();
    render(<Page options={{ title: 'Save failed', tone: 'danger' }} duration={null} />);

    await user.click(screen.getByRole('button', { name: 'Notify' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Save failed');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('dismisses by the button and by Escape on it', async () => {
    const user = userEvent.setup();
    render(<Page duration={null} />);

    await user.click(screen.getByRole('button', { name: 'Notify' }));
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Replay saved')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Notify' }));
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Replay saved')).not.toBeInTheDocument();
  });

  it('dismisses itself when its time is up', async () => {
    const user = userEvent.setup();
    render(<Page />);

    await user.click(screen.getByRole('button', { name: 'Notify' }));
    expect(screen.getByText('Replay saved')).toBeInTheDocument();

    await gone('Replay saved');
  });

  it('pauses the timer while hovered and resumes when the pointer leaves', async () => {
    const user = userEvent.setup();
    render(<Page />);

    await user.click(screen.getByRole('button', { name: 'Notify' }));
    await user.hover(screen.getByText('Replay saved'));
    await sleep(DURATION * 3);
    expect(screen.getByText('Replay saved')).toBeInTheDocument();

    await user.unhover(screen.getByText('Replay saved'));
    await gone('Replay saved');
  });

  it('pauses the timer while focus is inside', async () => {
    const user = userEvent.setup();
    render(<Page />);

    await user.click(screen.getByRole('button', { name: 'Notify' }));
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveFocus();
    await sleep(DURATION * 3);
    expect(screen.getByText('Replay saved')).toBeInTheDocument();

    await user.tab();
    await gone('Replay saved');
  });

  it('keeps a toast without a duration until it is dismissed', async () => {
    const user = userEvent.setup();
    render(<Page duration={null} />);

    await user.click(screen.getByRole('button', { name: 'Notify' }));
    await sleep(DURATION * 3);
    expect(screen.getByText('Replay saved')).toBeInTheDocument();
  });

  it('needs a provider', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useToast())).toThrow('useToast needs a ToastProvider');

    error.mockRestore();
  });

  it('has no accessibility violations with toasts of every tone', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ToastProvider duration={null}>
        <Notifier options={{ title: 'Info' }} />
        <Notifier options={{ title: 'Saved', tone: 'success' }} />
        <Notifier options={{ title: 'Failed', tone: 'danger', description: 'Try again' }} />
      </ToastProvider>,
    );

    for (const button of screen.getAllByRole('button', { name: 'Notify' })) {
      await user.click(button);
    }
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(await axe(container)).toHaveNoViolations();
  });
});
