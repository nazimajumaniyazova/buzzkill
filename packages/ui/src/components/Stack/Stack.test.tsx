import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { Stack } from './Stack';

describe('Stack', () => {
  it('renders the children in order inside one container', () => {
    render(
      <Stack data-testid="stack">
        <p>First</p>
        <p>Second</p>
      </Stack>,
    );

    const paragraphs = within(screen.getByTestId('stack')).getAllByRole('paragraph');
    expect(paragraphs.map((paragraph) => paragraph.textContent)).toEqual(['First', 'Second']);
  });

  it('defaults to a medium gap and stretched children, both set through data attributes', () => {
    render(<Stack data-testid="stack">Content</Stack>);

    const stack = screen.getByTestId('stack');
    expect(stack).toHaveClass('stack');
    expect(stack).toHaveAttribute('data-gap', 'md');
    expect(stack).toHaveAttribute('data-align', 'stretch');
  });

  it('takes a gap and an alignment and keeps the caller class name and attributes', () => {
    render(
      <Stack gap="xl" align="center" className="hero" role="group" aria-label="Choices">
        Content
      </Stack>,
    );

    const stack = screen.getByRole('group', { name: 'Choices' });
    expect(stack).toHaveAttribute('data-gap', 'xl');
    expect(stack).toHaveAttribute('data-align', 'center');
    expect(stack).toHaveClass('stack', 'hero');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <Stack>
        <button type="button">One</button>
        <button type="button">Two</button>
      </Stack>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
