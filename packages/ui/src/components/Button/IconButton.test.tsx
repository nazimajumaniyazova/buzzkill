import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('takes its accessible name from the label and shows it as a tooltip', () => {
    render(<IconButton label="Close">✕</IconButton>);

    const button = screen.getByRole('button', { name: 'Close' });
    expect(button).toHaveAttribute('title', 'Close');
    expect(button).toHaveClass('button', 'iconButton');
  });

  it('hides the icon from assistive technology and keeps the label as hidden text', () => {
    render(<IconButton label="Close">✕</IconButton>);

    expect(screen.getByText('✕')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Close')).toHaveClass('visuallyHidden');
  });

  it('passes the button props through', () => {
    render(
      <IconButton label="Pause" variant="secondary" size="sm" disabled>
        ❚❚
      </IconButton>,
    );

    const button = screen.getByRole('button', { name: 'Pause' });
    expect(button).toHaveAttribute('data-variant', 'secondary');
    expect(button).toHaveAttribute('data-size', 'sm');
    expect(button).toBeDisabled();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <>
        <IconButton label="Close">✕</IconButton>
        <IconButton label="Pause" loading>
          ❚❚
        </IconButton>
      </>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
