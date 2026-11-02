import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { App } from './App';

vi.mock('@buzzkill/game/legacy', () => ({
  Game: class {
    gameOver = false;
    update = vi.fn();
    draw = vi.fn();
  },
}));

describe('App', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the start screen first and passes the accessibility check', async () => {
    const { container } = render(<App />);

    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.queryByText('Buzzkill game screen')).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('replaces the start screen with the game canvas when the player presses Play', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      // jsdom has no canvas implementation; the loop only needs clearRect.
      { clearRect: vi.fn() } as unknown as CanvasRenderingContext2D,
    );
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(screen.getByText('Buzzkill game screen')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
  });
});
