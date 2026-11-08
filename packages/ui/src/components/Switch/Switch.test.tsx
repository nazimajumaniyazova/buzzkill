import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { Switch } from './Switch';

describe('Switch', () => {
  it('is a switch named by its label, off by default', () => {
    render(<Switch label="Sound" />);

    const control = screen.getByRole('switch', { name: 'Sound' });
    expect(control).toHaveAttribute('aria-checked', 'false');
    expect(control).toHaveAttribute('type', 'button');
    expect(control).toHaveClass('switch');
  });

  it('toggles with a click, with Space and with Enter, and reports every change', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch label="Sound" onCheckedChange={onCheckedChange} />);
    const control = screen.getByRole('switch', { name: 'Sound' });

    await user.click(control);
    expect(control).toHaveAttribute('aria-checked', 'true');
    await user.keyboard(' ');
    expect(control).toHaveAttribute('aria-checked', 'false');
    await user.keyboard('{Enter}');
    expect(control).toHaveAttribute('aria-checked', 'true');
    expect(onCheckedChange.mock.calls).toEqual([[true], [false], [true]]);
  });

  it('starts on with defaultChecked and follows the parent when controlled', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    const { rerender } = render(<Switch label="Sound" defaultChecked />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');

    rerender(<Switch label="Sound" checked={false} onCheckedChange={onCheckedChange} />);
    await user.click(screen.getByRole('switch'));
    expect(onCheckedChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('does nothing while disabled', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch label="Sound" disabled onCheckedChange={onCheckedChange} />);

    await user.click(screen.getByRole('switch'));
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('has no accessibility violations off and on', async () => {
    const { container } = render(
      <>
        <Switch label="Sound" />
        <Switch label="Music" defaultChecked />
        <Switch label="Vibration" disabled />
      </>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
