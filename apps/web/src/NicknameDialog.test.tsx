import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { NicknameSaved } from './backend/nickname';
import { NicknameDialog } from './NicknameDialog';

const RULES = '2 to 20 letters, digits, dots, dashes or underscores, with one space between words.';

const field = () => screen.getByRole('textbox', { name: 'Nickname' });

function type(value: string): void {
  fireEvent.change(field(), { target: { value } });
}

function save(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
}

describe('NicknameDialog', () => {
  it('is a modal dialog with the nickname field focused and its rules, and passes axe', async () => {
    const { baseElement } = render(
      <NicknameDialog nickname="Busy Bee" onSave={vi.fn()} onClose={vi.fn()} />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Your nickname' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Other players see it next to your scores.');
    expect(field()).toHaveFocus();
    expect(field()).toHaveValue('Busy Bee');
    expect(field()).toHaveAccessibleDescription(RULES);
    expect(field()).toHaveAttribute('autocomplete', 'nickname');
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it('says what is wrong with a nickname before sending it, and keeps focus on the field', async () => {
    const onSave = vi.fn();
    const { baseElement } = render(
      <NicknameDialog nickname={null} onSave={onSave} onClose={vi.fn()} />,
    );
    expect(field()).toHaveValue('');

    type(' B ');
    save();
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(field()).toHaveAccessibleDescription(`${RULES} A nickname has at least 2 characters.`);
    expect(field()).toHaveFocus();
    expect(await axe(baseElement)).toHaveNoViolations();

    // Typing again clears the error until the next try.
    type('B'.repeat(21));
    expect(field()).not.toHaveAttribute('aria-invalid');
    save();
    expect(field()).toHaveAccessibleDescription(`${RULES} A nickname has at most 20 characters.`);

    type('Bee 🐝');
    save();
    expect(field()).toHaveAccessibleDescription(
      `${RULES} Use only letters, digits, dots, dashes and underscores, with one space between words.`,
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves the nickname as the database takes it, once, then closes', async () => {
    let finish: (saved: NicknameSaved) => void = () => undefined;
    const onSave = vi.fn(
      () =>
        new Promise<NicknameSaved>((resolve) => {
          finish = resolve;
        }),
    );
    const onClose = vi.fn();
    render(<NicknameDialog nickname={null} onSave={onSave} onClose={onClose} />);

    type('  Busy   Bee ');
    fireEvent.submit(field());
    expect(onSave).toHaveBeenCalledExactlyOnceWith('Busy Bee');
    // While it saves, the button says so and a second press sends nothing.
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Saving…' }));
    expect(onSave).toHaveBeenCalledOnce();

    await act(async () => {
      finish({ ok: true });
      await Promise.resolve();
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('tells the player when the nickname could not be saved, and lets them try again', async () => {
    const onSave = vi
      .fn<(nickname: string) => Promise<NicknameSaved>>()
      .mockResolvedValueOnce({ ok: false, problem: 'offline' })
      .mockResolvedValueOnce({ ok: false, problem: 'unavailable' });
    const onClose = vi.fn();
    render(<NicknameDialog nickname="Busy Bee" onSave={onSave} onClose={onClose} />);

    await act(async () => {
      save();
      await Promise.resolve();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No connection, so the nickname is not saved. Try again later.',
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();

    await act(async () => {
      save();
      await Promise.resolve();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The server did not save the nickname. Try again later.',
    );
    expect(field()).toHaveValue('Busy Bee');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes without saving by Cancel, by Escape and by the close button', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<NicknameDialog nickname="Busy Bee" onSave={onSave} onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Your nickname' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(3);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows a nickname with markup as the text it is', () => {
    render(<NicknameDialog nickname="<b>Bee</b>" onSave={vi.fn()} onClose={vi.fn()} />);

    expect(field()).toHaveValue('<b>Bee</b>');
    expect(screen.queryByText('Bee')).toBeNull();
  });
});
