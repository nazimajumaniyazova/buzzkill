import { DIFFICULTY_IDS } from '@buzzkill/game';
import * as z from 'zod/mini';

import type { SettingsStorage } from '../state/settings/storage';
import { type Board, BOARD_SIZE, type BoardRow } from './boards';
import { PENDING_RUNS_KEY } from './run-queue';

/** A run of this browser in the queue, not yet on the server (#220), as a board reads it. */
export interface WaitingRun {
  readonly board: Board;
  readonly score: number;
  readonly level: number;
  /** The game speed it was played at, as a fraction of normal (ADR-0014). */
  readonly speed: number;
}

/** A row the board shows: one the server sent, or the player's run still waiting to be sent. */
type ShownRow =
  | { readonly waiting: false; readonly row: BoardRow }
  | { readonly waiting: true; readonly score: number; readonly level: number };

const STORED = z.object({
  runs: z.array(z.object({ gameVersion: z.string(), body: z.string() })),
});

/** The parts of a request body (`submissionBody`) a board needs. */
const BODY = z.object({
  replay: z.object({
    difficulty: z.enum(DIFFICULTY_IDS),
    daily: z.nullable(z.string()),
  }),
  claimed: z.object({ score: z.number(), level: z.number() }),
  speed: z.number(),
});

/** `text` as JSON, or `undefined` when it is not. */
function parsed(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * The runs of this version of the game waiting in the queue (#220), in the order they ended. They
 * are read as the queue wrote them; anything else is left out, and a storage that cannot be read
 * has none.
 */
export function waitingRuns(
  storage: Pick<SettingsStorage, 'getItem'> | null,
  gameVersion: string,
): WaitingRun[] {
  let json: string | null;
  try {
    json = storage?.getItem(PENDING_RUNS_KEY) ?? null;
  } catch {
    return [];
  }
  const stored = json === null ? null : STORED.safeParse(parsed(json));
  if (stored?.success !== true) {
    return [];
  }
  const runs: WaitingRun[] = [];
  for (const run of stored.data.runs) {
    const body = run.gameVersion === gameVersion ? BODY.safeParse(parsed(run.body)) : null;
    if (body?.success !== true) {
      continue;
    }
    const { replay, claimed, speed } = body.data;
    runs.push({
      board:
        replay.daily === null
          ? { mode: 'classic', difficulty: replay.difficulty }
          : { mode: 'daily', day: replay.daily },
      score: claimed.score,
      level: claimed.level,
      speed,
    });
  }
  return runs;
}

/** Whether two boards are the same one. */
export const sameBoard = (one: Board, other: Board): boolean =>
  one.mode === 'classic'
    ? other.mode === 'classic' && other.difficulty === one.difficulty
    : other.mode === 'daily' && other.day === one.day;

/**
 * The board as the player should see it (#220): the server's rows with the player's best run of
 * this board that waits to be sent, at full speed, as the server would rank it. A board keeps one
 * run per player, so it takes the place of the player's stored run when it beats it, and does not
 * show when it does not. A run of the same score as a stored one comes after it, as the later
 * run; one below the tenth place does not show.
 */
export function rowsWithWaiting(
  rows: readonly BoardRow[],
  waiting: readonly WaitingRun[],
  board: Board,
  me: string | null,
): ShownRow[] {
  const shown: ShownRow[] = rows.map((row) => ({ waiting: false, row }));
  let best: WaitingRun | null = null;
  for (const run of waiting) {
    if (
      run.speed === 1 &&
      sameBoard(run.board, board) &&
      (best === null || run.score > best.score)
    ) {
      best = run;
    }
  }
  const mine = me === null ? undefined : rows.find((row) => row.userId === me);
  if (best === null || (mine !== undefined && mine.score >= best.score)) {
    return shown;
  }
  const { score, level } = best;
  const others = shown.filter((item) => item.waiting || item.row !== mine);
  const place = others.findIndex((item) => !item.waiting && item.row.score < score);
  const waitingRow: ShownRow = { waiting: true, score, level };
  others.splice(place === -1 ? others.length : place, 0, waitingRow);
  return others.slice(0, BOARD_SIZE);
}
