import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { KeyHint } from './KeyHint';

describe('KeyHint', () => {
  it('shows the name on a key cap when there is no symbol', () => {
    render(<KeyHint>Space</KeyHint>);

    const key = screen.getByText('Space');
    expect(key.tagName).toBe('KBD');
    expect(key).toHaveClass('keyHint');
    expect(key).toHaveAttribute('data-kind', 'key');
  });

  it('prints the symbol for sighted users and keeps the name for assistive technology', () => {
    render(<KeyHint symbol="↑">Arrow up</KeyHint>);

    expect(screen.getByText('↑')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Arrow up')).toBeInTheDocument();
    expect(screen.getByText('Arrow up')).not.toHaveAttribute('aria-hidden');
    expect(screen.getByText('Arrow up')).toHaveClass('visuallyHidden');
  });

  it('marks a gamepad button', () => {
    render(<KeyHint kind="gamepad">Button A</KeyHint>);

    const button = screen.getByText('Button A');
    expect(button.tagName).toBe('KBD');
    expect(button).toHaveAttribute('data-kind', 'gamepad');
  });

  it('has no accessibility violations in a sentence of controls', async () => {
    const { container } = render(
      <p>
        <KeyHint symbol="↑">Arrow up</KeyHint> and <KeyHint symbol="↓">Arrow down</KeyHint> to move,{' '}
        <KeyHint>Space</KeyHint> to shoot, <KeyHint>Escape</KeyHint> to pause.
      </p>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
