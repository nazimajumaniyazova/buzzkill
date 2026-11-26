// @vitest-environment node
import { type Replay, REPLAY_FORMAT_VERSION, type RunResult } from '@buzzkill/game';
import { describe, expect, it } from 'vitest';

import type { BoardRow } from './boards';
import { PENDING_RUNS_KEY, submissionBody } from './run-queue';
import { rowsWithWaiting, type WaitingRun, waitingRuns } from './waiting-runs';

const VERSION = '0.44.0+0123456789ab';
const ME = '00000000-0000-4000-8000-00000000000a';

const replay = (difficulty: Replay['difficulty'], daily: string | null): Replay => ({
  formatVersion: REPLAY_FORMAT_VERSION,
  gameVersion: VERSION,
  seed: 7,
  heroId: 'male',
  mode: 'day',
  difficulty,
  daily,
  inputs: [],
});

const result = (score: number, level: number): RunResult => ({
  status: 'lost',
  score,
  level,
  ticks: 600,
  livesLeft: 0,
  hash: '0badf00d',
});

/** A storage holding `runs` as the queue writes them. */
function storageWith(runs: readonly { readonly gameVersion: string; readonly body: string }[]) {
  const items = new Map([[PENDING_RUNS_KEY, JSON.stringify({ version: 1, runs })]]);
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
  };
}

describe('waitingRuns', () => {
  it('reads the runs the queue keeps, with their board, score, level and speed', () => {
    const storage = storageWith([
      {
        gameVersion: VERSION,
        body: submissionBody({ result: result(900, 4), replay: replay('hard', null) }, 1),
      },
      {
        gameVersion: VERSION,
        body: submissionBody(
          { result: result(500, 2), replay: replay('normal', '2026-11-27') },
          0.75,
        ),
      },
    ]);

    expect(waitingRuns(storage, VERSION)).toEqual([
      { board: { mode: 'classic', difficulty: 'hard' }, score: 900, level: 4, speed: 1 },
      { board: { mode: 'daily', day: '2026-11-27' }, score: 500, level: 2, speed: 0.75 },
    ]);
  });

  it('leaves out runs of another version, and anything it cannot read', () => {
    const storage = storageWith([
      {
        gameVersion: 'older',
        body: submissionBody({ result: result(900, 4), replay: replay('hard', null) }, 1),
      },
      { gameVersion: VERSION, body: 'not json' },
      { gameVersion: VERSION, body: '{"claimed":{"score":1}}' },
    ]);

    expect(waitingRuns(storage, VERSION)).toEqual([]);
    expect(waitingRuns(null, VERSION)).toEqual([]);
    expect(waitingRuns({ getItem: () => '{' }, VERSION)).toEqual([]);
    expect(
      waitingRuns(
        {
          getItem: () => {
            throw new Error('denied');
          },
        },
        VERSION,
      ),
    ).toEqual([]);
  });
});

describe('rowsWithWaiting', () => {
  const HARD = { mode: 'classic', difficulty: 'hard' } as const;
  const row = (id: string, userId: string, score: number): BoardRow => ({
    id,
    userId,
    nickname: null,
    score,
    level: 3,
    createdAt: '2026-11-26T10:00:00Z',
  });
  const waiting = (score: number, board: WaitingRun['board'] = HARD, speed = 1): WaitingRun => ({
    board,
    score,
    level: 5,
    speed,
  });

  it('shows the best run waiting for this board in its place, in the place of the stored one', () => {
    const rows = [row('a', 'ann', 900), row('b', ME, 500), row('c', 'cat', 400)];

    expect(rowsWithWaiting(rows, [waiting(600), waiting(700)], HARD, ME)).toEqual([
      { waiting: false, row: rows[0] },
      { waiting: true, score: 700, level: 5 },
      { waiting: false, row: rows[2] },
    ]);
  });

  it('keeps the stored run when it is the better one, and ties go to the board', () => {
    const rows = [row('a', 'ann', 900), row('b', ME, 700)];

    expect(rowsWithWaiting(rows, [waiting(700)], HARD, ME)).toEqual([
      { waiting: false, row: rows[0] },
      { waiting: false, row: rows[1] },
    ]);
  });

  it('shows a waiting run of a browser without a player, after the runs of its score', () => {
    const rows = [row('a', 'ann', 900), row('b', 'bob', 600)];

    expect(rowsWithWaiting(rows, [waiting(600)], HARD, null)).toEqual([
      { waiting: false, row: rows[0] },
      { waiting: false, row: rows[1] },
      { waiting: true, score: 600, level: 5 },
    ]);
  });

  it('leaves out runs of other boards, runs at a slower speed, and what falls off the board', () => {
    const full = Array.from({ length: 10 }, (_, index) =>
      row(String(index), `player-${String(index)}`, 1000 - index * 10),
    );

    expect(
      rowsWithWaiting(
        full,
        [
          waiting(5000, { mode: 'classic', difficulty: 'easy' }),
          waiting(5000, { mode: 'daily', day: '2026-11-27' }),
          waiting(5000, HARD, 0.75),
          waiting(10),
        ],
        HARD,
        null,
      ),
    ).toEqual(full.map((stored) => ({ waiting: false, row: stored })));
  });
});
