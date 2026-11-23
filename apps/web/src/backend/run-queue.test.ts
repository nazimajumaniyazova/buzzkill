// @vitest-environment node
import { type Replay, REPLAY_FORMAT_VERSION, type RunResult } from '@buzzkill/game';
import { describe, expect, it, vi } from 'vitest';

import {
  createRunQueue,
  MAX_PENDING_RUNS,
  outcomeOf,
  PENDING_RUNS_KEY,
  type QueueLock,
  type SendOutcome,
  submissionBody,
} from './run-queue';

const replay: Replay = {
  formatVersion: REPLAY_FORMAT_VERSION,
  gameVersion: '0.39.0+0123456789ab',
  seed: 7,
  heroId: 'male',
  mode: 'day',
  difficulty: 'normal',
  daily: null,
  inputs: [30, 1, 12, 0],
};

const result: RunResult = {
  score: 189,
  level: 3,
  ticks: 6564,
  livesLeft: 0,
  status: 'lost',
  hash: '0a1b2c3d',
};

/** A `localStorage` in memory; with `broken`, every call throws, as in a sandboxed frame. */
function memoryStorage(initial: Record<string, string> = {}, broken = false) {
  const items = new Map(Object.entries(initial));
  const check = (): void => {
    if (broken) {
      throw new Error('SecurityError');
    }
  };
  return {
    items,
    getItem(key: string) {
      check();
      return items.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      check();
      items.set(key, value);
    },
    removeItem(key: string) {
      check();
      items.delete(key);
    },
  };
}

const stored = (id: string): SendOutcome => ({ kind: 'stored', id });
const later = (retryAfter?: number): SendOutcome =>
  retryAfter === undefined ? { kind: 'later' } : { kind: 'later', retryAfter };

describe('submissionBody', () => {
  it('is what the submit-run function reads: the replay, the result claimed and the speed', () => {
    expect(JSON.parse(submissionBody({ result, replay }, 0.75))).toEqual({
      replay,
      claimed: { score: 189, level: 3, ticks: 6564, hash: '0a1b2c3d' },
      speed: 0.75,
    });
  });
});

describe('outcomeOf', () => {
  it('reads a stored run by the id the function gives it', () => {
    expect(outcomeOf(201, { id: 'run-1', score: 189 }, null)).toEqual(stored('run-1'));
  });

  it('gives up a run the function refuses for good, with its reason', () => {
    for (const [status, reason] of [
      [400, 'invalid'],
      [409, 'stale-version'],
      [413, 'too-large'],
      [422, 'mismatch'],
    ] as const) {
      expect(outcomeOf(status, { reason, detail: '…' }, null)).toEqual({ kind: 'refused', reason });
    }
    expect(outcomeOf(422, 'not json', null)).toEqual({ kind: 'refused', reason: 'unknown' });
  });

  it('keeps for later a run that needs a player, waits for the hour, or met a failure', () => {
    expect(outcomeOf(401, { reason: 'unauthorized' }, null)).toEqual(later());
    expect(outcomeOf(429, { reason: 'too-many-runs' }, '1200')).toEqual(later(1200));
    expect(outcomeOf(429, { reason: 'too-many-runs' }, 'soon')).toEqual(later());
    expect(outcomeOf(503, null, null)).toEqual(later());
    expect(outcomeOf(201, { score: 189 }, null)).toEqual(later());
  });
});

describe('createRunQueue', () => {
  it('keeps a run in the storage until it is sent, so it survives a reload', async () => {
    const storage = memoryStorage();
    const send = vi.fn((_body: string) => Promise.resolve(later()));

    createRunQueue({ storage, send }).add('{"run":1}');

    const reloaded = createRunQueue({ storage, send });
    expect(reloaded.size()).toBe(1);
    expect(await reloaded.flush()).toEqual({ stored: [], refused: 0, left: 1 });
    expect(send).toHaveBeenCalledWith('{"run":1}');
  });

  it('sends the runs in the order they ended and forgets each one stored or refused', async () => {
    const storage = memoryStorage();
    const outcomes: SendOutcome[] = [
      stored('a'),
      { kind: 'refused', reason: 'mismatch' },
      stored('c'),
    ];
    const send = vi.fn((_body: string) => Promise.resolve(outcomes.shift() ?? later()));
    const queue = createRunQueue({ storage, send });
    queue.add('1');
    queue.add('2');
    queue.add('3');

    expect(await queue.flush()).toEqual({ stored: ['a', 'c'], refused: 1, left: 0 });
    expect(send.mock.calls.map(([body]) => body)).toEqual(['1', '2', '3']);
    expect(queue.size()).toBe(0);
    expect(JSON.parse(storage.items.get(PENDING_RUNS_KEY) ?? 'null')).toEqual({
      version: 1,
      runs: [],
    });
  });

  it('stops at the first run kept for later, which waits in its place with those after it', async () => {
    const outcomes: SendOutcome[] = [stored('a'), later(60)];
    const send = vi.fn((_body: string) => Promise.resolve(outcomes.shift() ?? stored('z')));
    const queue = createRunQueue({ storage: memoryStorage(), send });
    queue.add('1');
    queue.add('2');
    queue.add('3');

    expect(await queue.flush()).toEqual({ stored: ['a'], refused: 0, left: 2, retryAfter: 60 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(await queue.flush()).toEqual({ stored: ['z', 'z'], refused: 0, left: 0 });
    expect(send.mock.calls.map(([body]) => body)).toEqual(['1', '2', '2', '3']);
  });

  it('keeps a run that ends while another is on its way', async () => {
    const queue = createRunQueue({
      storage: memoryStorage(),
      send: (body) => {
        if (body === '1') {
          queue.add('2');
        }
        return Promise.resolve(body === '1' ? stored('a') : later());
      },
    });
    queue.add('1');

    expect(await queue.flush()).toEqual({ stored: ['a'], refused: 0, left: 1 });
    expect(queue.size()).toBe(1);
  });

  it('keeps a run whose sending throws, as a failure of the network', async () => {
    const send = vi.fn((_body: string) => Promise.reject(new TypeError('Failed to fetch')));
    const queue = createRunQueue({ storage: memoryStorage(), send });
    queue.add('1');

    expect(await queue.flush()).toEqual({ stored: [], refused: 0, left: 1 });
  });

  it('runs one sending at a time: a flush during another waits for it and sends nothing again', async () => {
    let release = (): void => undefined;
    const send = vi.fn(
      (_body: string) =>
        new Promise<SendOutcome>((resolve) => {
          release = () => {
            resolve(stored('a'));
          };
        }),
    );
    const queue = createRunQueue({ storage: memoryStorage(), send });
    queue.add('1');

    const first = queue.flush();
    const second = queue.flush();
    release();

    expect(await first).toEqual({ stored: ['a'], refused: 0, left: 0 });
    expect(await second).toEqual({ stored: ['a'], refused: 0, left: 0 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends under the lock it is given, so two tabs never send the same run', async () => {
    const order: string[] = [];
    const lock: QueueLock = async (work) => {
      order.push('locked');
      const value = await work();
      order.push('released');
      return value;
    };
    const send = vi.fn((_body: string) => {
      order.push('sent');
      return Promise.resolve(stored('a'));
    });
    const queue = createRunQueue({ storage: memoryStorage(), send, lock });
    queue.add('1');

    await queue.flush();

    expect(order).toEqual(['locked', 'sent', 'released']);
  });

  it('reads the storage again under the lock, so a run another tab sent is not sent twice', async () => {
    const storage = memoryStorage();
    const send = vi.fn((_body: string) => Promise.resolve(stored('a')));
    const here = createRunQueue({ storage, send });
    const there = createRunQueue({ storage, send });
    here.add('1');

    await there.flush();
    expect(await here.flush()).toEqual({ stored: [], refused: 0, left: 0 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it(`keeps the ${String(MAX_PENDING_RUNS)} runs that ended last`, () => {
    const storage = memoryStorage();
    const queue = createRunQueue({ storage, send: vi.fn() });
    for (let run = 1; run <= MAX_PENDING_RUNS + 2; run += 1) {
      queue.add(String(run));
    }

    const kept = JSON.parse(storage.items.get(PENDING_RUNS_KEY) ?? 'null') as { runs: string[] };
    expect(kept.runs).toHaveLength(MAX_PENDING_RUNS);
    expect(kept.runs[0]).toBe('3');
    expect(kept.runs.at(-1)).toBe(String(MAX_PENDING_RUNS + 2));
  });

  it('starts empty from what is not a queue, and keeps only the runs it can read', () => {
    const send = vi.fn();
    const broken = { [PENDING_RUNS_KEY]: '{oops' };
    const other = { [PENDING_RUNS_KEY]: JSON.stringify({ version: 2, runs: ['1'] }) };
    const mixed = { [PENDING_RUNS_KEY]: JSON.stringify({ version: 1, runs: ['1', 7, null, '2'] }) };

    expect(createRunQueue({ storage: memoryStorage(broken), send }).size()).toBe(0);
    expect(createRunQueue({ storage: memoryStorage(other), send }).size()).toBe(0);
    expect(createRunQueue({ storage: memoryStorage(mixed), send }).size()).toBe(2);
  });

  it('works for the visit without a storage, or with one that throws', async () => {
    for (const storage of [null, memoryStorage({}, true)]) {
      const send = vi.fn((_body: string) => Promise.resolve(stored('a')));
      const queue = createRunQueue({ storage, send });
      queue.add('1');
      expect(queue.size()).toBe(1);
      expect(await queue.flush()).toEqual({ stored: ['a'], refused: 0, left: 0 });
    }
  });
});
