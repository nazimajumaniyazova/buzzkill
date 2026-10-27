import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { App } from './App';

describe('App', () => {
  it('renders the game canvas with accessible fallback text', async () => {
    const { container } = render(<App />);

    expect(screen.getByText('Buzzkill game screen')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
