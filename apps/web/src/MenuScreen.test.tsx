import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { MenuScreen } from './MenuScreen';

describe('MenuScreen', () => {
  it('offers Play, the theme and the controls, and passes the accessibility check', async () => {
    const { container } = render(
      <MenuScreen theme="system" onThemeChange={vi.fn()} onPlay={vi.fn()} />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Buzzkill' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Match the system' })).toBeChecked();
    expect(screen.getByText(/to pause/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reports Play', () => {
    const onPlay = vi.fn();
    render(<MenuScreen theme="system" onThemeChange={vi.fn()} onPlay={onPlay} />);

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(onPlay).toHaveBeenCalledOnce();
  });

  it('reports a theme pick and shows the theme it is given', () => {
    const onThemeChange = vi.fn();
    const { rerender } = render(
      <MenuScreen theme="system" onThemeChange={onThemeChange} onPlay={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Always night' }));

    expect(onThemeChange).toHaveBeenCalledExactlyOnceWith('night');

    rerender(<MenuScreen theme="night" onThemeChange={onThemeChange} onPlay={vi.fn()} />);

    expect(screen.getByRole('radio', { name: 'Always night' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Match the system' })).not.toBeChecked();
  });
});
