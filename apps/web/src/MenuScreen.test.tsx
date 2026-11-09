import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { MenuScreen } from './MenuScreen';

describe('MenuScreen', () => {
  it('offers Play, Settings and Help under the title, and passes the accessibility check', async () => {
    const { container } = render(
      <MenuScreen onPlay={vi.fn()} onSettings={vi.fn()} onHelp={vi.fn()} />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Buzzkill' })).toBeInTheDocument();
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Play',
      'Settings',
      'Help',
    ]);
    expect(screen.getByRole('navigation', { name: 'Main menu' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reports each choice', () => {
    const onPlay = vi.fn();
    const onSettings = vi.fn();
    const onHelp = vi.fn();
    render(<MenuScreen onPlay={onPlay} onSettings={onSettings} onHelp={onHelp} />);

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));

    expect(onPlay).toHaveBeenCalledOnce();
    expect(onSettings).toHaveBeenCalledOnce();
    expect(onHelp).toHaveBeenCalledOnce();
  });
});
