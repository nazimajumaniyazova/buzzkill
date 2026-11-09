import type { KeyBindings } from '@buzzkill/engine';
import { DEFAULT_KEY_BINDINGS, type GameAction } from '@buzzkill/game';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { KeyBindingsEditor } from './KeyBindingsEditor';

function setup(bindings: KeyBindings<GameAction> = DEFAULT_KEY_BINDINGS) {
  const onChange = vi.fn<(bindings: KeyBindings<GameAction>) => void>();
  const view = render(<KeyBindingsEditor bindings={bindings} onChange={onChange} />);
  const status = () => screen.getByRole('status');
  return { onChange, status, ...view };
}

describe('KeyBindingsEditor', () => {
  const outside = vi.fn();

  afterEach(() => {
    window.removeEventListener('keydown', outside);
    outside.mockClear();
  });

  it('shows two keys per action in a table and passes the accessibility check', async () => {
    const { container } = setup();

    const table = screen.getByRole('table', { name: 'Keyboard' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual([
      'Move up',
      'Move down',
      'Shoot',
      'Pause',
    ]);
    expect(screen.getByRole('button', { name: 'Shoot, key 1: Space' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause, key 2: P' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('binds the next key pressed, and says so', () => {
    const { onChange, status } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Shoot, key 2: J' }));
    expect(status()).toHaveTextContent('Press a key for Shoot, or Escape to cancel.');
    expect(
      screen.getByRole('button', { name: 'Shoot, key 2: waiting for a key' }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: 'f', code: 'KeyF' });

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      ...DEFAULT_KEY_BINDINGS,
      fire: ['Space', 'KeyF'],
    });
    expect(status()).toHaveTextContent('Shoot now uses F.');
  });

  it('swaps a key that another action holds, and names the action that moved', () => {
    const { onChange, status } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Pause, key 1: Escape' }));
    fireEvent.keyDown(document.body, { key: ' ', code: 'Space' });

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      ...DEFAULT_KEY_BINDINGS,
      fire: ['Escape', 'KeyJ'],
      pause: ['Space', 'KeyP'],
    });
    expect(status()).toHaveTextContent(
      'Pause now uses Space. Space was taken from Shoot, which now uses Escape.',
    );
  });

  it('keeps the pressed key from the rest of the page', () => {
    window.addEventListener('keydown', outside);
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Shoot, key 2: J' }));
    fireEvent.keyDown(document.body, { key: 'f', code: 'KeyF' });

    expect(outside).not.toHaveBeenCalled();
  });

  it('cancels on Escape without a change, and keeps Escape from the page too', () => {
    window.addEventListener('keydown', outside);
    const { onChange, status } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Shoot, key 2: J' }));
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });

    expect(onChange).not.toHaveBeenCalled();
    expect(outside).not.toHaveBeenCalled();
    expect(status()).toHaveTextContent('No change.');
    expect(screen.getByRole('button', { name: 'Shoot, key 2: J' })).toBeInTheDocument();
  });

  it('lets Tab move on: it cancels the wait and reaches the page', () => {
    window.addEventListener('keydown', outside);
    const { onChange } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Shoot, key 2: J' }));
    fireEvent.keyDown(document.body, { key: 'Tab', code: 'Tab' });

    expect(onChange).not.toHaveBeenCalled();
    expect(outside).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Shoot, key 2: J' })).toBeInTheDocument();
  });

  it('cancels the wait when focus leaves the key', () => {
    const { onChange } = setup();
    const button = screen.getByRole('button', { name: 'Shoot, key 2: J' });

    fireEvent.click(button);
    fireEvent.blur(button);
    fireEvent.keyDown(document.body, { key: 'f', code: 'KeyF' });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the bindings it is given and resets them to the defaults', () => {
    const custom = { ...DEFAULT_KEY_BINDINGS, fire: ['KeyF', 'KeyJ'] };
    const { onChange, status } = setup(custom);

    expect(screen.getByRole('button', { name: 'Shoot, key 1: F' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset keys' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(DEFAULT_KEY_BINDINGS);
    expect(status()).toHaveTextContent('The default keys are back.');
  });
});
