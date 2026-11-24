import { type Replay, type RunResult, serializeReplay } from '@buzzkill/game';
import * as z from 'zod/mini';

import type { GameSpeed } from '../state/settings/schema';
import type { SettingsStorage } from '../state/settings/storage';

/** Where the runs waiting to be sent live in `localStorage` (#220). */
export const PENDING_RUNS_KEY = 'buzzkill.pending-runs';

/**
 * How many runs wait at most. A whole campaign's request is about 17 kB, so twenty take a few
 * hundred kilobytes of the storage; past them, the run that ended first gives way.
 */
export const MAX_PENDING_RUNS = 20;

/**
 * The stored form: the version of the form, and the runs in the order they ended, each with its
 * request body and the version of the game that played it.
 */
const STORED = z.object({ version: z.literal(1), runs: z.array(z.unknown()) });
const PENDING = z.object({ gameVersion: z.string(), body: z.string() });

type PendingRun = z.infer<typeof PENDING>;

/**
 * The body of a request to the submit-run function (#218) for a finished run: its replay, the
 * result the game found, which the server must find too, and the game speed (ADR-0014).
 */
export function submissionBody(
  { result, replay }: { readonly result: RunResult; readonly replay: Replay },
  speed: GameSpeed,
): string {
  const { score, level, ticks, hash } = result;
  return `{"replay":${serializeReplay(replay)},"claimed":${JSON.stringify({ score, level, ticks, hash })},"speed":${JSON.stringify(speed)}}`;
}

/** What became of one run sent. */
export type SendOutcome =
  /** The server played it, found it as claimed, and stored it under `id`. */
  | { readonly kind: 'stored'; readonly id: string }
  /** The server will never store it: an invalid or forged run. */
  | { readonly kind: 'refused'; readonly reason: string }
  /**
   * Not now: no network, no player signed in, the hour's play already sent (`retryAfter`, in
   * seconds), a server that plays another version of the game, or a failure of the server. The
   * run waits.
   */
  | { readonly kind: 'later'; readonly retryAfter?: number };

/** Sends one request body to the submit-run function. A throw counts as `later`. */
type SendRun = (body: string) => Promise<SendOutcome>;

const ANSWER = z.object({ id: z.optional(z.string()), reason: z.optional(z.string()) });

/**
 * The outcome of the submit-run function's answer: `status`, the JSON `body` and the
 * `Retry-After` header. 201 stores; 400, 413 and 422 refuse for good; anything else, an answer
 * that cannot be read included, is for later.
 *
 * 409 says the server plays another version of the game than the run's, but not which one is
 * newer. The web deploys before the function, so for a few minutes a run of the new build meets
 * the old function and must wait for the new one. A run of an old build waits too, until a reload
 * brings the new build, whose queue forgets it.
 */
export function outcomeOf(status: number, body: unknown, retryAfter: string | null): SendOutcome {
  const answer = ANSWER.safeParse(body);
  if (status === 201) {
    return answer.success && answer.data.id !== undefined
      ? { kind: 'stored', id: answer.data.id }
      : { kind: 'later' };
  }
  if (status === 400 || status === 413 || status === 422) {
    return {
      kind: 'refused',
      reason: (answer.success ? answer.data.reason : undefined) ?? 'unknown',
    };
  }
  const seconds = Number(retryAfter);
  return status === 429 && retryAfter !== null && Number.isInteger(seconds) && seconds > 0
    ? { kind: 'later', retryAfter: seconds }
    : { kind: 'later' };
}

/** What one sending did. */
interface FlushReport {
  /** The ids of the runs stored, in the order sent. */
  readonly stored: readonly string[];
  /** How many runs were refused for good and given up. */
  readonly refused: number;
  /** How many runs still wait. */
  readonly left: number;
  /** The seconds the server asked to wait, when it did. */
  readonly retryAfter?: number;
}

/** Runs `work` alone across the tabs of the game: `navigator.locks` in the browser. */
export type QueueLock = <T>(work: () => Promise<T>) => Promise<T>;

export interface RunQueueOptions {
  /** `localStorage`, or `null` where there is none: the runs then wait for this visit only. */
  readonly storage: SettingsStorage | null;
  readonly send: SendRun;
  /**
   * The version of the game this build plays, and so of every run it adds. The runs of another
   * version, left by an older build, are forgotten: no server plays them again.
   */
  readonly gameVersion: string;
  /** Without one, the queue only keeps its own tab from sending a run twice. */
  readonly lock?: QueueLock;
}

export interface RunQueue {
  /** Puts the body of a run this build finished at the end of the queue. */
  add(body: string): void;
  /**
   * Sends the waiting runs in order until one is for later. A call during a sending returns that
   * sending's report.
   */
  flush(): Promise<FlushReport>;
  /** How many runs wait. */
  size(): number;
}

/**
 * The runs waiting to reach the server (#220): a run that ends without a network, or before a
 * player is signed in, waits here, and survives a reload until it is sent. The storage is read
 * again for each operation, so that a run another tab sent is not sent twice.
 */
export function createRunQueue({
  storage,
  send,
  gameVersion,
  lock = (work) => work(),
}: RunQueueOptions): RunQueue {
  // The runs of this visit where the storage cannot be used.
  let memory: readonly PendingRun[] = [];
  let sending: Promise<FlushReport> | null = null;

  const read = (): readonly PendingRun[] => {
    try {
      if (storage === null) {
        return memory;
      }
      const json = storage.getItem(PENDING_RUNS_KEY);
      if (json === null) {
        return [];
      }
      const stored = STORED.safeParse(JSON.parse(json));
      if (!stored.success) {
        return [];
      }
      const runs: PendingRun[] = [];
      for (const item of stored.data.runs) {
        const run = PENDING.safeParse(item);
        if (run.success && run.data.gameVersion === gameVersion) {
          runs.push(run.data);
        }
      }
      return runs;
    } catch {
      return memory;
    }
  };

  const write = (runs: readonly PendingRun[]): void => {
    memory = runs;
    try {
      storage?.setItem(PENDING_RUNS_KEY, JSON.stringify({ version: 1, runs }));
    } catch {
      // A full or blocked storage keeps the runs for this visit only.
    }
  };

  const sendAll = async (): Promise<FlushReport> => {
    const ids: string[] = [];
    let refused = 0;
    for (;;) {
      const first = read()[0];
      if (first === undefined) {
        return { stored: ids, refused, left: 0 };
      }
      let outcome: SendOutcome;
      try {
        outcome = await send(first.body);
      } catch {
        outcome = { kind: 'later' };
      }
      // Read again: a run may have ended while this one was on its way.
      const runs = read();
      if (outcome.kind === 'later') {
        const left = runs.length;
        return outcome.retryAfter === undefined
          ? { stored: ids, refused, left }
          : { stored: ids, refused, left, retryAfter: outcome.retryAfter };
      }
      if (outcome.kind === 'stored') {
        ids.push(outcome.id);
      } else {
        refused += 1;
      }
      // The same body, which another tab may have sent and removed meanwhile.
      const index = runs.findIndex((run) => run.body === first.body);
      write(index === -1 ? runs : runs.filter((_, at) => at !== index));
    }
  };

  return {
    add(body) {
      write([...read(), { gameVersion, body }].slice(-MAX_PENDING_RUNS));
    },
    flush() {
      sending ??= lock(sendAll).finally(() => {
        sending = null;
      });
      return sending;
    },
    size: () => read().length,
  };
}
