import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { Inline } from './Inline';

describe('Inline', () => {
  it('renders the children in order inside one wrapping container', () => {
    render(
      <Inline data-testid="inline">
        <span>First</span>
        <span>Second</span>
      </Inline>,
    );

    const inline = screen.getByTestId('inline');
    expect(inline).toHaveClass('inline');
    const items = within(inline).getAllByText(/First|Second/);
    expect(items.map((item) => item.textContent)).toEqual(['First', 'Second']);
  });

  it('defaults to a medium gap, centered within the line, packed at the start', () => {
    render(<Inline data-testid="inline">Content</Inline>);

    const inline = screen.getByTestId('inline');
    expect(inline).toHaveAttribute('data-gap', 'md');
    expect(inline).toHaveAttribute('data-align', 'center');
    expect(inline).toHaveAttribute('data-justify', 'start');
  });

  it('takes a gap, an alignment and a distribution and keeps the caller props', () => {
    render(
      <Inline
        gap="sm"
        align="baseline"
        justify="between"
        className="toolbar"
        role="toolbar"
        aria-label="Actions"
      >
        Content
      </Inline>,
    );

    const inline = screen.getByRole('toolbar', { name: 'Actions' });
    expect(inline).toHaveAttribute('data-gap', 'sm');
    expect(inline).toHaveAttribute('data-align', 'baseline');
    expect(inline).toHaveAttribute('data-justify', 'between');
    expect(inline).toHaveClass('inline', 'toolbar');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <Inline>
        <button type="button">One</button>
        <button type="button">Two</button>
      </Inline>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
