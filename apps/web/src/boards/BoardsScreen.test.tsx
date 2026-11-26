import { QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { Board, BoardRow, BoardsSource, PersonalBest } from '../backend/boards';
import { BoardsScreen } from './BoardsScreen';

const ME = '00000000-0000-4000-8000-00000000000a';

function row(place: number, nickname: string | null, userId = `user-${String(place)}`): BoardRow {
  return {
    id: `run-${String(place)}`,
    userId,
    nickname,
    score: 1000 - place * 100,
    level: 3,
    createdAt: '2026-11-23T10:00:00Z',
  };
}

const best = (speed: number): PersonalBest => ({
  id: 'run-mine',
  userId: ME,
  score: 1234,
  level: 5,
  createdAt: '2026-11-22T10:00:00Z',
  speed,
});

/** A query client that fails at once, as the tests of an offline board need. */
const testClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

function renderScreen(source: BoardsSource, onBack = vi.fn()) {
  return render(
    <BoardsScreen
      source={source}
      today="2026-11-24"
      difficulty="normal"
      onBack={onBack}
      queryClient={testClient()}
    />,
  );
}

describe('BoardsScreen', () => {
  it('opens on the board of the player difficulty, with the top runs and their places', async () => {
    const board = vi.fn((_board: Board) =>
      Promise.resolve([row(1, 'Bob'), row(2, null), row(3, 'Ann', ME)]),
    );
    const { container } = renderScreen({
      board,
      personalBest: () => Promise.resolve({ userId: ME, best: best(100) }),
    });

    expect(screen.getByRole('heading', { level: 1, name: 'Boards' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Normal' })).toHaveAttribute('aria-selected', 'true');
    const table = await screen.findByRole('table', { name: 'Top 10, Normal' });
    expect(board).toHaveBeenCalledWith({ mode: 'classic', difficulty: 'normal' });

    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((tr) => tr.textContent)).toEqual([
      '1Bob9003',
      '2A player without a nickname8003',
      '3Ann (you)7003',
    ]);
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Place', 'Player', 'Score', 'Level']);
    expect(await screen.findByText('Your best: 1,234, level 5.')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows the run waiting to be sent in its place, over the stored one it beats (#220)', async () => {
    const { container } = render(
      <BoardsScreen
        source={{
          board: () => Promise.resolve([row(1, 'Bob'), row(2, 'Ann', ME), row(3, null)]),
          personalBest: () => Promise.resolve({ userId: ME, best: null }),
        }}
        today="2026-11-24"
        difficulty="normal"
        waiting={[
          { board: { mode: 'classic', difficulty: 'normal' }, score: 950, level: 6, speed: 1 },
        ]}
        onBack={vi.fn()}
        queryClient={testClient()}
      />,
    );

    const table = await screen.findByRole('table', { name: 'Top 10, Normal' });
    await screen.findByText('Your run, waiting to be sent');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((tr) => tr.textContent)).toEqual([
      '1Your run, waiting to be sent9506',
      '2Bob9003',
      '3A player without a nickname7003',
    ]);
    expect(rows[0]).toHaveAttribute('data-mine', 'true');
    expect(await axe(container)).toHaveNoViolations();
  });

  it("shows today's board of the daily challenge on its tab", async () => {
    const board = vi.fn((_board: Board) => Promise.resolve([row(1, 'Bob')]));
    renderScreen({
      board,
      personalBest: () => Promise.resolve({ userId: null, best: null }),
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Today' }));

    expect(
      await screen.findByRole('table', { name: 'Top 10 of November 24, 2026' }),
    ).toBeInTheDocument();
    expect(board).toHaveBeenLastCalledWith({ mode: 'daily', day: '2026-11-24' });
    expect(
      await screen.findByText('Your best run of this board appears here once one is stored.'),
    ).toBeInTheDocument();
  });

  it('says a personal record at a slower speed counts only for the player', async () => {
    renderScreen({
      board: () => Promise.resolve([]),
      personalBest: () => Promise.resolve({ userId: ME, best: best(75) }),
    });

    expect(await screen.findByText('No runs on this board yet.')).toBeInTheDocument();
    expect(
      await screen.findByText(
        'Your best: 1,234, level 5. Played at 75% speed, so only you see it.',
      ),
    ).toBeInTheDocument();
  });

  it('says when the board cannot be loaded, and tries again on request', async () => {
    const board = vi
      .fn<(board: Board) => Promise<BoardRow[]>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([row(1, 'Bob')]);
    const { container } = renderScreen({
      board,
      personalBest: () => Promise.reject(new Error('offline')),
    });

    expect(
      await screen.findByText(
        'The board cannot be loaded right now. Your runs are kept and go out when the network is back.',
      ),
    ).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('table', { name: 'Top 10, Normal' })).toBeInTheDocument();
  });

  it('says that it loads while the board is on its way', () => {
    renderScreen({
      board: () => new Promise(() => undefined),
      personalBest: () => new Promise(() => undefined),
    });

    expect(screen.getByRole('status')).toHaveTextContent('Loading the board…');
  });

  it('shows a nickname with markup as the text it is', async () => {
    renderScreen({
      board: () => Promise.resolve([row(1, '<img src=x onerror=alert(1)>')]),
      personalBest: () => Promise.resolve({ userId: null, best: null }),
    });

    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('goes back to the menu', () => {
    const onBack = vi.fn();
    renderScreen(
      {
        board: () => Promise.resolve([]),
        personalBest: () => Promise.resolve({ userId: null, best: null }),
      },
      onBack,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledOnce();
  });
});
