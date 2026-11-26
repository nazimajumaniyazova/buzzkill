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

/** A player who never sent a run: no profile, and no nickname to pick. */
const NO_PROFILE = {
  profile: () => Promise.resolve(null),
  saveNickname: () => Promise.resolve({ ok: false, problem: 'unavailable' } as const),
};

function renderScreen(
  source: Omit<BoardsSource, keyof typeof NO_PROFILE> & Partial<BoardsSource>,
  onBack = vi.fn(),
) {
  return render(
    <BoardsScreen
      source={{ ...NO_PROFILE, ...source }}
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

  it('lets a player pick a nickname, then shows it on the boards (#217)', async () => {
    let nickname: string | null = null;
    const board = vi.fn(() => Promise.resolve([row(1, nickname, ME)]));
    const saveNickname = vi.fn((name: string) => {
      nickname = name;
      return Promise.resolve({ ok: true } as const);
    });
    const { container } = renderScreen({
      board,
      personalBest: () => Promise.resolve({ userId: ME, best: null }),
      profile: () => Promise.resolve({ userId: ME, nickname }),
      saveNickname,
    });

    expect(await screen.findByText('You have no nickname yet.')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    fireEvent.click(screen.getByRole('button', { name: 'Pick a nickname' }));

    const dialog = screen.getByRole('dialog', { name: 'Your nickname' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nickname' }), {
      target: { value: 'Ann' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Your nickname: Ann.')).toBeInTheDocument();
    expect(saveNickname).toHaveBeenCalledExactlyOnceWith('Ann');
    expect(screen.queryByRole('dialog')).toBeNull();
    // The boards read again, with the new name.
    expect(await screen.findByText('Ann (you)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change the nickname' })).toBeInTheDocument();
  });

  it('offers no nickname to a player who never sent a run', async () => {
    renderScreen({
      board: () => Promise.resolve([row(1, 'Bob')]),
      personalBest: () => Promise.resolve({ userId: null, best: null }),
    });

    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: /nickname/ })).toBeNull();
  });

  it('offers to watch each run, named by its player, when it can (#219)', async () => {
    const onWatch = vi.fn();
    const { container } = render(
      <BoardsScreen
        source={{
          board: () => Promise.resolve([row(1, 'Bob'), row(2, null), row(3, 'Ann', ME)]),
          personalBest: () => Promise.resolve({ userId: ME, best: null }),
          ...NO_PROFILE,
        }}
        today="2026-11-24"
        difficulty="normal"
        onWatch={onWatch}
        onBack={vi.fn()}
        queryClient={testClient()}
      />,
    );

    const table = await screen.findByRole('table', { name: 'Top 10, Normal' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Place', 'Player', 'Score', 'Level', 'Replay']);
    expect(
      within(table)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual([
      'Watch the run of Bob',
      'Watch the run of A player without a nickname',
      'Watch the run of Ann (you)',
    ]);

    fireEvent.click(within(table).getByRole('button', { name: 'Watch the run of Ann (you)' }));
    expect(onWatch).toHaveBeenCalledExactlyOnceWith('run-3');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows the run waiting to be sent in its place, over the stored one it beats (#220)', async () => {
    const { container } = render(
      <BoardsScreen
        source={{
          board: () => Promise.resolve([row(1, 'Bob'), row(2, 'Ann', ME), row(3, null)]),
          personalBest: () => Promise.resolve({ userId: ME, best: null }),
          ...NO_PROFILE,
        }}
        today="2026-11-24"
        difficulty="normal"
        onWatch={vi.fn()}
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
      '2Bob9003Watch',
      '3A player without a nickname7003Watch',
    ]);
    expect(rows[0]).toHaveAttribute('data-mine', 'true');
    // Not on the server yet: nothing to watch on its row, while the others have their button.
    expect(within(rows[0] as HTMLElement).queryByRole('button')).toBeNull();
    expect(within(table).getAllByRole('button')).toHaveLength(2);
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
