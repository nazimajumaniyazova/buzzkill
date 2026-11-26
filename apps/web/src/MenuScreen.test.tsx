import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { MenuScreen } from './MenuScreen';

function setup(dailyBest: number | null = null) {
  const handlers = {
    onPlay: vi.fn(),
    onDaily: vi.fn(),
    onPreload: vi.fn(),
    onSettings: vi.fn(),
    onAchievements: vi.fn(),
    onHelp: vi.fn(),
  };
  const view = render(<MenuScreen {...handlers} dailyBest={dailyBest} />);
  return { ...handlers, ...view };
}

describe('MenuScreen', () => {
  it('offers Play, Settings, Achievements and Help under the title, and passes axe', async () => {
    const { container } = setup();

    expect(screen.getByRole('heading', { level: 1, name: 'Buzzkill' })).toBeInTheDocument();
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Play',
      'Daily challenge',
      'Settings',
      'Achievements',
      'Help',
    ]);
    expect(screen.getByRole('navigation', { name: 'Main menu' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('offers the boards after the daily challenge in a build with a backend only (#220)', () => {
    const onBoards = vi.fn();
    render(
      <MenuScreen
        onPlay={vi.fn()}
        onDaily={vi.fn()}
        onPreload={vi.fn()}
        onSettings={vi.fn()}
        onAchievements={vi.fn()}
        onHelp={vi.fn()}
        onBoards={onBoards}
        dailyBest={null}
      />,
    );

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Play',
      'Daily challenge',
      'Boards',
      'Settings',
      'Achievements',
      'Help',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Boards' }));
    expect(onBoards).toHaveBeenCalledOnce();
  });

  it('reports each choice', () => {
    const { onPlay, onSettings, onAchievements, onHelp } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Achievements' }));
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));

    expect(onPlay).toHaveBeenCalledOnce();
    expect(onSettings).toHaveBeenCalledOnce();
    expect(onAchievements).toHaveBeenCalledOnce();
    expect(onHelp).toHaveBeenCalledOnce();
  });

  it("offers the daily challenge, with this device's best score of the day under it (#165)", () => {
    const { onDaily, onPreload, unmount } = setup();
    const daily = screen.getByRole('button', { name: 'Daily challenge' });
    expect(daily).toHaveAccessibleDescription('Not played today yet');

    fireEvent.pointerEnter(daily);
    fireEvent.click(daily);
    expect(onPreload).toHaveBeenCalledOnce();
    expect(onDaily).toHaveBeenCalledOnce();
    unmount();

    setup(1234);
    expect(screen.getByRole('button', { name: 'Daily challenge' })).toHaveAccessibleDescription(
      "Today's best: 1,234",
    );
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
