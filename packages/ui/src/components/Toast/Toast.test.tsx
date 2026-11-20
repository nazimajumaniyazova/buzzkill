import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { Button } from '../Button/Button';
import type { ToastOptions } from './toast-context';
import { ToastProvider } from './ToastProvider';
import { useToast } from './use-toast';

/** The toast's time in the timer tests, on fake timers. */
const DURATION = 4000;

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

  describe('its timer', () => {
    // Fake timers move only when a test moves them, so a busy machine cannot run a toast's time
    // out between two steps of a test (#226). The steps are synchronous events: user-event waits
    // through Testing Library on timers that only Jest's fake timers would move.
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const notify = (): void => {
      fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
    };

    const wait = (ms: number): void => {
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    };

    const shown = (): boolean => screen.queryByText('Replay saved') !== null;

    it('dismisses the toast when its time is up', () => {
      render(<Page />);

      notify();
      wait(DURATION - 1);
      expect(shown()).toBe(true);

      wait(1);
      expect(shown()).toBe(false);
    });

    it('pauses while the toast is hovered and resumes with the time left when the pointer leaves', () => {
      render(<Page />);

      notify();
      wait(DURATION / 2);
      fireEvent.pointerEnter(screen.getByRole('listitem'));
      wait(DURATION * 3);
      expect(shown()).toBe(true);

      fireEvent.pointerLeave(screen.getByRole('listitem'));
      wait(DURATION / 2 - 1);
      expect(shown()).toBe(true);
      wait(1);
      expect(shown()).toBe(false);
    });

    it('pauses while focus is inside the toast', () => {
      render(<Page />);

      notify();
      act(() => {
        screen.getByRole('button', { name: 'Dismiss' }).focus();
      });
      wait(DURATION * 3);
      expect(shown()).toBe(true);

      act(() => {
        screen.getByRole('button', { name: 'Elsewhere' }).focus();
      });
      wait(DURATION);
      expect(shown()).toBe(false);
    });

    it('keeps a toast without a duration until it is dismissed', () => {
      render(<Page duration={null} />);

      notify();
      wait(DURATION * 100);
      expect(shown()).toBe(true);
    });
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
