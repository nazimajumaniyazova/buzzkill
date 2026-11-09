import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { Tabs } from './Tabs';

const ITEMS = [
  { value: 'controls', label: 'Controls', panel: <p>Keys and gamepad</p> },
  { value: 'audio', label: 'Audio', panel: <p>Volume</p> },
  { value: 'cheats', label: 'Cheats', panel: <p>None</p>, disabled: true },
  { value: 'display', label: 'Display', panel: <p>Theme</p> },
] as const;

const tab = (name: string): HTMLElement => screen.getByRole('tab', { name });

describe('Tabs', () => {
  it('follows the pattern: a named tablist, tabs, and one panel labelled by its tab', () => {
    render(<Tabs label="Settings" items={ITEMS} />);

    expect(screen.getByRole('tablist', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(tab('Controls')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Audio')).toHaveAttribute('aria-selected', 'false');
    expect(tab('Cheats')).toBeDisabled();

    const panel = screen.getByRole('tabpanel', { name: 'Controls' });
    expect(panel).toHaveTextContent('Keys and gamepad');
    expect(tab('Controls')).toHaveAttribute('aria-controls', panel.id);
    expect(screen.queryByText('Volume')).not.toBeInTheDocument();
  });

  it('keeps one tab in the Tab order and the panel reachable', async () => {
    const user = userEvent.setup();
    render(<Tabs label="Settings" items={ITEMS} defaultValue="audio" />);

    expect(tab('Audio')).toHaveAttribute('tabindex', '0');
    expect(tab('Controls')).toHaveAttribute('tabindex', '-1');
    await user.tab();
    expect(tab('Audio')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('tabpanel', { name: 'Audio' })).toHaveFocus();
  });

  it('selects on click and reports the value', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Tabs label="Settings" items={ITEMS} onValueChange={onValueChange} />);

    await user.click(tab('Display'));

    expect(tab('Display')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Display' })).toHaveTextContent('Theme');
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('display');
  });

  it('moves and selects with the arrows, skipping disabled tabs and wrapping around', async () => {
    const user = userEvent.setup();
    render(<Tabs label="Settings" items={ITEMS} />);

    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(tab('Audio')).toHaveFocus();
    expect(tab('Audio')).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowRight}');
    expect(tab('Display')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(tab('Controls')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(tab('Display')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(tab('Controls')).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{End}');
    expect(tab('Display')).toHaveAttribute('aria-selected', 'true');
  });

  it('only moves focus in manual mode until Enter or Space selects', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Tabs label="Settings" items={ITEMS} activation="manual" onValueChange={onValueChange} />,
    );

    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(tab('Audio')).toHaveFocus();
    expect(tab('Controls')).toHaveAttribute('aria-selected', 'true');
    expect(onValueChange).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    expect(tab('Audio')).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowRight}');
    await user.keyboard(' ');
    expect(tab('Display')).toHaveAttribute('aria-selected', 'true');
    expect(onValueChange.mock.calls).toEqual([['audio'], ['display']]);
  });

  it('follows the parent when controlled', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <Tabs label="Settings" items={ITEMS} value="audio" onValueChange={onValueChange} />,
    );

    await user.click(tab('Display'));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('display');
    expect(tab('Audio')).toHaveAttribute('aria-selected', 'true');

    rerender(<Tabs label="Settings" items={ITEMS} value="display" onValueChange={onValueChange} />);
    expect(tab('Display')).toHaveAttribute('aria-selected', 'true');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Tabs label="Settings" items={ITEMS} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
