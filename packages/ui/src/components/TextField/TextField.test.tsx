import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { TextField } from './TextField';

describe('TextField', () => {
  it('is a text box named by its label and described by its hint', () => {
    render(<TextField label="Nickname" description="2 to 20 letters or digits." />);

    const field = screen.getByRole('textbox', { name: 'Nickname' });
    expect(field).toHaveAttribute('type', 'text');
    expect(field).toHaveAccessibleDescription('2 to 20 letters or digits.');
    expect(field).not.toHaveAttribute('aria-invalid');
  });

  it('holds what is typed itself and reports every change', () => {
    const onValueChange = vi.fn();
    render(<TextField label="Nickname" defaultValue="Bee" onValueChange={onValueChange} />);
    const field = screen.getByRole('textbox', { name: 'Nickname' });

    expect(field).toHaveValue('Bee');
    fireEvent.change(field, { target: { value: 'Bumblebee' } });
    expect(field).toHaveValue('Bumblebee');
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('Bumblebee');
  });

  it('follows the parent when controlled', () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <TextField label="Nickname" value="Bee" onValueChange={onValueChange} />,
    );
    const field = screen.getByRole('textbox', { name: 'Nickname' });

    fireEvent.change(field, { target: { value: 'Wasp' } });
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('Wasp');
    expect(field).toHaveValue('Bee');

    rerender(<TextField label="Nickname" value="Wasp" onValueChange={onValueChange} />);
    expect(field).toHaveValue('Wasp');
  });

  it('marks an error as invalid and adds it to the description, in words', () => {
    render(
      <TextField
        label="Nickname"
        description="2 to 20 letters or digits."
        error="Too short."
        defaultValue="B"
      />,
    );

    const field = screen.getByRole('textbox', { name: 'Nickname' });
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('2 to 20 letters or digits. Too short.');
    expect(screen.getByText('Too short.')).toBeVisible();
  });

  it('passes the input attributes through, and keeps its own type and value', () => {
    render(
      <TextField
        label="Nickname"
        maxLength={40}
        autoComplete="nickname"
        spellCheck={false}
        required
      />,
    );

    const field = screen.getByRole('textbox', { name: 'Nickname' });
    expect(field).toHaveAttribute('maxlength', '40');
    expect(field).toHaveAttribute('autocomplete', 'nickname');
    expect(field).toHaveAttribute('spellcheck', 'false');
    expect(field).toBeRequired();
  });

  it('has no accessibility violations, with an error or without', async () => {
    const { container, rerender } = render(
      <TextField label="Nickname" description="2 to 20 letters or digits." />,
    );
    expect(await axe(container)).toHaveNoViolations();

    rerender(
      <TextField label="Nickname" description="2 to 20 letters or digits." error="Too short." />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
