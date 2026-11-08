import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { VisuallyHidden } from './VisuallyHidden';

describe('VisuallyHidden', () => {
  it('keeps the text in the document and in the accessible name of its parent', () => {
    render(
      <button type="button">
        <span aria-hidden="true">✕</span>
        <VisuallyHidden>Close</VisuallyHidden>
      </button>,
    );

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.getByText('Close')).toHaveClass('visuallyHidden');
  });

  it('does not hide the content from assistive technology', () => {
    render(<VisuallyHidden>Only for screen readers</VisuallyHidden>);

    const hidden = screen.getByText('Only for screen readers');
    expect(hidden).toBeVisible();
    expect(hidden).not.toHaveAttribute('aria-hidden');
    expect(hidden).not.toHaveAttribute('hidden');
  });

  it('keeps the caller class name and attributes', () => {
    render(
      <VisuallyHidden className="extra" id="status">
        Saved
      </VisuallyHidden>,
    );

    expect(screen.getByText('Saved')).toHaveClass('visuallyHidden', 'extra');
    expect(screen.getByText('Saved')).toHaveAttribute('id', 'status');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <p>
        Score <VisuallyHidden>is</VisuallyHidden> 120
      </p>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
