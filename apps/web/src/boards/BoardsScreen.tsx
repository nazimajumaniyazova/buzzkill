import type { Difficulty } from '@buzzkill/game';
import { Button, Stack, type TabItem, Tabs } from '@buzzkill/ui';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { type JSX, useId, useState } from 'react';

import { type Board, BOARD_SIZE, type BoardRow, type BoardsSource } from '../backend/boards';
import { noonOf } from '../i18n/format';
import { useI18n } from '../i18n/i18n';
import { NicknameDialog } from '../NicknameDialog';

const DIFFICULTIES = ['easy', 'normal', 'hard'] as const satisfies readonly Difficulty[];

type BoardTab = Difficulty | 'today';

export interface BoardsScreenProps {
  /** Where the boards come from: the backend, or a fake in a test. */
  readonly source: BoardsSource;
  /** The UTC date of today's daily challenge (#165). */
  readonly today: string;
  /** The difficulty of the player's settings, whose board opens first. */
  readonly difficulty: Difficulty;
  /** Opens the replay of a run (#219); without it, the boards offer none. */
  readonly onWatch?: (runId: string) => void;
  readonly onBack: () => void;
  /** The cache of the boards; the screen makes its own when none is given. */
  readonly queryClient?: QueryClient;
}

/**
 * The cache of the boards (#220). A board stays fresh for a minute, so moving between the tabs
 * does not ask again. Offline, a query fails instead of waiting for the network, so the board
 * says it is offline; it tries twice more first, since a paused free project takes a moment to
 * wake (ADR-0007).
 */
function createBoardsQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 2,
        networkMode: 'always',
        refetchOnWindowFocus: false,
      },
    },
  });
}

const boardOf = (tab: BoardTab, today: string): Board =>
  tab === 'today' ? { mode: 'daily', day: today } : { mode: 'classic', difficulty: tab };

const keyOf = (board: Board): readonly string[] =>
  board.mode === 'daily' ? ['daily', board.day] : ['classic', board.difficulty];

interface BoardPanelProps {
  readonly source: BoardsSource;
  readonly board: Board;
  readonly caption: string;
  readonly onWatch: ((runId: string) => void) | undefined;
}

/** One board: its table of the top runs, and the player's own record under it. */
function BoardPanel({ source, board, caption, onWatch }: BoardPanelProps): JSX.Element {
  const { t, format } = useI18n();
  const runs = useQuery({
    queryKey: ['board', ...keyOf(board)],
    queryFn: () => source.board(board),
  });
  const record = useQuery({
    queryKey: ['personal-best', ...keyOf(board)],
    queryFn: () => source.personalBest(board),
  });
  const me = record.data?.userId ?? null;

  const playerName = (row: BoardRow): string => {
    // The nickname is untrusted text (#217): JSX writes it as text, never as markup.
    const name = row.nickname ?? t.boards.noNickname;
    return row.userId === me ? t.boards.you(name) : name;
  };

  let table: JSX.Element;
  if (runs.isPending) {
    table = <p role="status">{t.boards.loading}</p>;
  } else if (runs.isError) {
    table = (
      <Stack gap="md" align="center">
        <p>{t.boards.offline}</p>
        <Button
          variant="secondary"
          onClick={() => {
            void runs.refetch();
            void record.refetch();
          }}
        >
          {t.boards.retry}
        </Button>
      </Stack>
    );
  } else if (runs.data.length === 0) {
    table = <p>{t.boards.empty}</p>;
  } else {
    table = (
      <table className="board">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t.boards.columns.place}</th>
            <th scope="col">{t.boards.columns.player}</th>
            <th scope="col">{t.boards.columns.score}</th>
            <th scope="col">{t.boards.columns.level}</th>
            {onWatch !== undefined && <th scope="col">{t.boards.columns.replay}</th>}
          </tr>
        </thead>
        <tbody>
          {runs.data.map((row, index) => (
            <tr key={row.id} data-mine={row.userId === me}>
              <td>{format.number(index + 1)}</td>
              <td>{playerName(row)}</td>
              <td>{format.number(row.score)}</td>
              <td>{format.number(row.level)}</td>
              {onWatch !== undefined && (
                <td>
                  {/* The label names the player: a list of buttons all named Watch says nothing. */}
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={t.boards.watchRun(playerName(row))}
                    onClick={() => {
                      onWatch(row.id);
                    }}
                  >
                    {t.boards.watch}
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  let personal: JSX.Element | null = null;
  if (record.isSuccess) {
    const { best } = record.data;
    personal =
      best === null ? (
        <p>{t.boards.noRecord}</p>
      ) : (
        <p>
          {best.speed === 100
            ? t.boards.personalBest(best.score, best.level)
            : `${t.boards.personalBest(best.score, best.level)} ${t.boards.slower(best.speed / 100)}`}
        </p>
      );
  }

  return (
    <Stack gap="lg" align="center">
      {table}
      {personal}
    </Stack>
  );
}

/**
 * The player's nickname under the boards (#217), and the dialog that picks it. Only a player, who
 * has sent a run, has one to pick. A saved nickname makes the boards read again, so the player's
 * rows show it at once.
 */
function NicknamePanel({ source }: { readonly source: BoardsSource }): JSX.Element | null {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [picking, setPicking] = useState(false);
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => source.profile() });

  if (!profile.isSuccess || profile.data === null) {
    return null;
  }
  const { nickname } = profile.data;
  return (
    <Stack gap="sm" align="center">
      <p>{nickname === null ? t.boards.noNicknameYet : t.boards.nicknameIs(nickname)}</p>
      <Button
        variant="secondary"
        onClick={() => {
          setPicking(true);
        }}
      >
        {nickname === null ? t.boards.pickNickname : t.boards.changeNickname}
      </Button>
      {picking && (
        <NicknameDialog
          nickname={nickname}
          onSave={async (picked) => {
            const saved = await source.saveNickname(picked);
            if (saved.ok) {
              await queryClient.invalidateQueries();
            }
            return saved;
          }}
          onClose={() => {
            setPicking(false);
          }}
        />
      )}
    </Stack>
  );
}

/**
 * The `boards` panel of the menu (#220): the top runs of each difficulty and of today's daily
 * challenge, and the player's own record of each. It downloads as a chunk of its own, with
 * TanStack Query, when the player opens it; the menu never waits for it.
 */
export function BoardsScreen({
  source,
  today,
  difficulty,
  onWatch,
  onBack,
  queryClient,
}: BoardsScreenProps): JSX.Element {
  const titleId = useId();
  const { t } = useI18n();
  const [client] = useState(() => queryClient ?? createBoardsQueryClient());

  const panel = (tab: BoardTab, caption: string): TabItem<BoardTab> => ({
    value: tab,
    label: tab === 'today' ? t.boards.today : t.settings.difficulties[tab],
    panel: (
      <BoardPanel source={source} board={boardOf(tab, today)} caption={caption} onWatch={onWatch} />
    ),
  });

  return (
    <QueryClientProvider client={client}>
      <section className="screen" aria-labelledby={titleId}>
        <Stack gap="xl" align="center">
          <Stack gap="sm" align="center">
            <h1 id={titleId}>{t.boards.title}</h1>
            <p>{t.boards.intro}</p>
          </Stack>
          <Tabs
            label={t.boards.tabs}
            defaultValue={difficulty}
            items={[
              ...DIFFICULTIES.map((tab) =>
                panel(tab, t.boards.caption(BOARD_SIZE, t.settings.difficulties[tab])),
              ),
              panel('today', t.boards.dailyCaption(BOARD_SIZE, noonOf(today))),
            ]}
          />
          <NicknamePanel source={source} />
          <Button variant="secondary" onClick={onBack}>
            {t.common.back}
          </Button>
        </Stack>
      </section>
    </QueryClientProvider>
  );
}
