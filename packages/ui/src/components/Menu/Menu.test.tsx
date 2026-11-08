import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { Menu, type MenuProps } from './Menu';
import { MenuItem } from './MenuItem';

type ExampleProps = Partial<Omit<MenuProps, 'children'>> & {
  readonly onSelect?: (item: string) => void;
};

function Example({ onSelect = (): void => undefined, ...props }: ExampleProps): JSX.Element {
  return (
    <>
      <Menu label="Options" {...props}>
        <MenuItem
          onSelect={() => {
            onSelect('resume');
          }}
        >
          Resume
        </MenuItem>
        <MenuItem
          disabled
          onSelect={() => {
            onSelect('save');
          }}
        >
          Save replay
        </MenuItem>
        <MenuItem
          onSelect={() => {
            onSelect('quit');
          }}
        >
          Quit
        </MenuItem>
      </Menu>
      <button type="button">Elsewhere</button>
    </>
  );
}

const trigger = (): HTMLElement => screen.getByRole('button', { name: 'Options' });
const items = (): HTMLElement[] => screen.getAllByRole('menuitem');

describe('Menu', () => {
  it('starts closed with a trigger that announces the menu', () => {
    render(<Example />);

    expect(trigger()).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens on click with the first item focused and a roving tabindex', async () => {
    const user = userEvent.setup();
    render(<Example />);

    await user.click(trigger());

    const menu = screen.getByRole('menu', { name: 'Options' });
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(trigger()).toHaveAttribute('aria-controls', menu.id);
    expect(items().map((item) => item.textContent)).toEqual(['Resume', 'Save replay', 'Quit']);
    expect(items()[0]).toHaveFocus();
    expect(items().map((item) => item.tabIndex)).toEqual([0, -1, -1]);
  });

  it('opens on ArrowDown with the first item and on ArrowUp with the last', async () => {
    const user = userEvent.setup();
    render(<Example />);

    await user.tab();
    await user.keyboard('{ArrowDown}');
    expect(items()[0]).toHaveFocus();

    await user.keyboard('{Escape}');
    await user.keyboard('{ArrowUp}');
    expect(items()[2]).toHaveFocus();
    expect(items().map((item) => item.tabIndex)).toEqual([-1, -1, 0]);
  });

  it('moves with the arrows, wraps around, and jumps with Home and End', async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(trigger());

    await user.keyboard('{ArrowDown}');
    expect(items()[1]).toHaveFocus();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(items()[0]).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(items()[2]).toHaveFocus();
    await user.keyboard('{Home}');
    expect(items()[0]).toHaveFocus();
    await user.keyboard('{End}');
    expect(items()[2]).toHaveFocus();
  });

  it('jumps to the next item starting with a typed letter', async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(trigger());

    await user.keyboard('q');
    expect(items()[2]).toHaveFocus();
    await user.keyboard('s');
    expect(items()[1]).toHaveFocus();
    await user.keyboard('x');
    expect(items()[1]).toHaveFocus();
  });

  it('activates with Enter, Space and click, then closes and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Example onSelect={onSelect} />);

    await user.click(trigger());
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenLastCalledWith('resume');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    await user.keyboard(' ');
    expect(onSelect).toHaveBeenLastCalledWith('quit');
    expect(trigger()).toHaveFocus();

    await user.click(trigger());
    await user.click(screen.getByRole('menuitem', { name: 'Quit' }));
    expect(onSelect).toHaveBeenCalledTimes(3);
    expect(trigger()).toHaveFocus();
  });

  it('keeps a disabled item reachable but inert', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Example onSelect={onSelect} />);

    await user.click(trigger());
    await user.keyboard('{ArrowDown}');
    const disabled = screen.getByRole('menuitem', { name: 'Save replay' });
    expect(disabled).toHaveFocus();
    expect(disabled).toHaveAttribute('aria-disabled', 'true');

    await user.keyboard('{Enter}');
    await user.click(disabled);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('closes on Escape with focus on the trigger, on a press outside, and on Tab', async () => {
    const user = userEvent.setup();
    render(<Example />);

    await user.click(trigger());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();

    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(trigger());
    await user.tab();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
  });

  it('starts open with defaultOpen and lets the parent control the state', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(<Example defaultOpen />);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    rerender(<Example open onOpenChange={onOpenChange} />);
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    rerender(<Example open={false} onOpenChange={onOpenChange} />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('has no accessibility violations closed and open', async () => {
    const user = userEvent.setup();
    const { container } = render(<Example />);

    expect(await axe(container)).toHaveNoViolations();
    await user.click(trigger());
    expect(await axe(container)).toHaveNoViolations();
  });
});
