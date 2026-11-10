import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { MenuScreen } from './MenuScreen';

function setup() {
  const handlers = { onPlay: vi.fn(), onPreload: vi.fn(), onSettings: vi.fn(), onHelp: vi.fn() };
  const view = render(<MenuScreen {...handlers} />);
  return { ...handlers, ...view };
}

describe('MenuScreen', () => {
  it('offers Play, Settings and Help under the title, and passes the accessibility check', async () => {
    const { container } = setup();

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
    const { onPlay, onSettings, onHelp } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));

    expect(onPlay).toHaveBeenCalledOnce();
    expect(onSettings).toHaveBeenCalledOnce();
    expect(onHelp).toHaveBeenCalledOnce();
  });

  it('asks for the game to preload when the pointer enters Play or Play gets focus', () => {
    const { onPreload, onPlay } = setup();
    const play = screen.getByRole('button', { name: 'Play' });

    fireEvent.pointerEnter(play);
    expect(onPreload).toHaveBeenCalledOnce();

    play.focus();
    expect(onPreload).toHaveBeenCalledTimes(2);
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('does not preload from the other choices', () => {
    const { onPreload } = setup();

    for (const name of ['Settings', 'Help']) {
      const button = screen.getByRole('button', { name });
      fireEvent.pointerEnter(button);
      button.focus();
    }

    expect(onPreload).not.toHaveBeenCalled();
  });
});
