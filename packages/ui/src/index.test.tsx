import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

describe('@buzzkill/ui test environment', () => {
  it('renders with Testing Library and checks accessibility with axe', async () => {
    const { container } = render(<button type="button">Play</button>);

    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
