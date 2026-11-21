import { dailySeed, parseReplay, simulate } from '@buzzkill/game';
import { describe, expect, it, vi } from 'vitest';

import {
  createSubmitRun,
  type HttpRequest,
  type RunStore,
  type SubmitRunDependencies,
} from './submit-run';
import { MAX_RUN_TICKS, MAX_SUBMISSION_BYTES } from './verify';

const GAME_VERSION = '0.36.0+5c06cad63ac3';
const PLAYER = '00000000-0000-4000-8000-00000000000a';

/** The idle run of verify.test.ts: lost after 1526 ticks without a move. */
const IDLE = {
  formatVersion: 3,
  gameVersion: GAME_VERSION,
  seed: 2026,
  heroId: 'male',
  mode: 'day',
  difficulty: 'normal',
  daily: null,
  inputs: [],
};
const IDLE_RESULT = { score: 0, level: 1, ticks: 1526, hash: '105607ed' };
/** What the game finds when it plays `replay`, as an honest client would claim it. */
function resultOf(replay: object) {
  const parsed = parseReplay(replay);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const { score, level, ticks, hash } = simulate(parsed.replay, { maxTicks: MAX_RUN_TICKS });
  return { score, level, ticks, hash };
}

const SUBMISSION = JSON.stringify({ replay: IDLE, claimed: IDLE_RESULT, speed: 1 });
const FORGED = JSON.stringify({ replay: IDLE, claimed: { ...IDLE_RESULT, score: 9999 }, speed: 1 });

interface RequestOptions {
  readonly method?: string;
  /** The Authorization header, or null for none. */
  readonly authorization?: string | null;
  readonly contentLength?: number;
}

function request(
  body: string,
  { method = 'POST', authorization = 'Bearer player-token', contentLength }: RequestOptions = {},
) {
  const headers = new Map<string, string>();
  if (authorization !== null) headers.set('authorization', authorization);
  if (contentLength !== undefined) headers.set('content-length', String(contentLength));
  return {
    method,
    header: (name: string) => headers.get(name.toLowerCase()) ?? null,
    text: vi.fn(() => Promise.resolve(body)),
  } satisfies HttpRequest;
}

function setup(overrides: Partial<RunStore> = {}, now = new Date('2026-11-20T15:00:00Z')) {
  const fullStore = {
    userOf: vi.fn<RunStore['userOf']>(
      overrides.userOf ?? ((token) => Promise.resolve(token === 'player-token' ? PLAYER : null)),
    ),
    addRun: vi.fn<RunStore['addRun']>(
      overrides.addRun ?? (() => Promise.resolve({ ok: true, id: 'run-1' })),
    ),
    logSuspicious: vi.fn<RunStore['logSuspicious']>(
      overrides.logSuspicious ?? (() => Promise.resolve()),
    ),
  };
  const dependencies: SubmitRunDependencies = {
    gameVersion: GAME_VERSION,
    now: () => now,
    // Not gzip, but as good for a test: bytes the store receives and the test can read back.
    gzip: (text) => Promise.resolve(new TextEncoderLike().encode(`gz:${text}`)),
    store: fullStore,
    report: vi.fn(),
  };
  return { submit: createSubmitRun(dependencies), store: fullStore, dependencies };
}

/** The arguments of the first call of `mock`. */
function firstCall<Arguments extends unknown[]>(mock: { mock: { calls: Arguments[] } }): Arguments {
  const call = mock.mock.calls[0];
  if (call === undefined) {
    throw new Error('not called');
  }
  return call;
}

/** UTF-8 of ASCII text, without the DOM's TextEncoder, which the package does not type. */
class TextEncoderLike {
  encode(text: string): Uint8Array {
    return Uint8Array.from(text, (character) => character.charCodeAt(0));
  }
}

const decode = (bytes: Uint8Array): string => String.fromCharCode(...bytes);

const json = (body: string | null): unknown => JSON.parse(body ?? 'null');

describe('submit-run', () => {
  it('stores a run that plays to its claim and answers 201 with its id', async () => {
    const { submit, store } = setup();

    const response = await submit(request(SUBMISSION));

    expect(response.status).toBe(201);
    expect(json(response.body)).toEqual({ id: 'run-1', ...IDLE_RESULT, status: 'lost' });
    expect(store.addRun).toHaveBeenCalledOnce();
    const [user, run, replay] = firstCall(store.addRun);
    expect(user).toBe(PLAYER);
    expect(run).toMatchObject({ score: 0, gameVersion: GAME_VERSION, speed: 100 });
    expect(JSON.parse(decode(replay).slice('gz:'.length))).toEqual(IDLE);
  });

  it('answers in JSON, to any origin, since no cookie is involved', async () => {
    const { submit } = setup();

    const response = await submit(request(SUBMISSION));

    expect(response.headers).toMatchObject({
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      // Without it, a script of another origin could not read when to try again (#235).
      'access-control-expose-headers': 'retry-after',
    });
  });

  it('answers the preflight of a browser with the allowed method and headers', async () => {
    const { submit, store } = setup();

    const response = await submit(request('', { method: 'OPTIONS' }));

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(response.headers['access-control-allow-methods']).toBe('POST, OPTIONS');
    expect(response.headers['access-control-allow-headers']).toContain('authorization');
    expect(store.userOf).not.toHaveBeenCalled();
  });

  it('refuses another method', async () => {
    const { submit } = setup();

    const response = await submit(request('', { method: 'GET' }));

    expect(response.status).toBe(405);
    expect(response.headers).toMatchObject({ allow: 'POST, OPTIONS' });
  });

  it.each([
    ['no token', null],
    ['another scheme', 'Basic abc'],
    ['a token Auth does not know', 'Bearer stolen'],
  ])('answers 401 to a request with %s, before reading it', async (_, authorization) => {
    const { submit, store } = setup();
    const unsigned = request(SUBMISSION, { authorization });

    const response = await submit(unsigned);

    expect(response.status).toBe(401);
    expect(json(response.body)).toMatchObject({ reason: 'unauthorized' });
    expect(unsigned.text).not.toHaveBeenCalled();
    expect(store.addRun).not.toHaveBeenCalled();
  });

  it('answers 413 to a request that announces too many bytes, before reading it', async () => {
    const { submit, store } = setup();
    const large = request(SUBMISSION, { contentLength: MAX_SUBMISSION_BYTES + 1 });

    const response = await submit(large);

    expect(response.status).toBe(413);
    expect(large.text).not.toHaveBeenCalled();
    expect(store.userOf).not.toHaveBeenCalled();
  });

  it('passes on a refusal of the verdict with its status, reason and detail', async () => {
    const { submit, store } = setup();

    const response = await submit(request('not json'));

    expect(response.status).toBe(400);
    expect(json(response.body)).toEqual({
      reason: 'invalid',
      detail: 'the submission is not valid JSON',
    });
    expect(store.addRun).not.toHaveBeenCalled();
    expect(store.logSuspicious).not.toHaveBeenCalled();
  });

  it('takes today from its clock, in UTC, for a daily run', async () => {
    const day = '2030-01-02';
    const replay = { ...IDLE, daily: day, seed: dailySeed(day) };
    const daily = request(JSON.stringify({ replay, claimed: resultOf(replay), speed: 1 }));

    const onTheDay = await setup({}, new Date(`${day}T23:59:00Z`)).submit(daily);
    const twoDaysLater = await setup({}, new Date('2030-01-04T00:00:00Z')).submit(daily);

    expect(onTheDay.status).toBe(201);
    expect(twoDaysLater.status).toBe(422);
    expect(json(twoDaysLater.body)).toMatchObject({ reason: 'not-today' });
  });

  it('logs a replay that plays to another result, and answers 422 without the found result', async () => {
    const { submit, store } = setup();

    const response = await submit(request(FORGED));

    expect(response.status).toBe(422);
    expect(json(response.body)).toEqual({
      reason: 'mismatch',
      detail: 'the replay does not play to the claimed result',
    });
    expect(store.addRun).not.toHaveBeenCalled();
    expect(store.logSuspicious).toHaveBeenCalledOnce();
    const [entry] = firstCall(store.logSuspicious);
    expect(entry).toMatchObject({
      userId: PLAYER,
      gameVersion: GAME_VERSION,
      seed: 2026,
      claimed: { score: 9999 },
      found: IDLE_RESULT,
    });
    expect(JSON.parse(decode(entry.replay).slice('gz:'.length))).toEqual(IDLE);
  });

  it('still answers 422 when the log fails, and reports the failure', async () => {
    const failure = new Error('log down');
    const { submit, dependencies } = setup({ logSuspicious: () => Promise.reject(failure) });

    const response = await submit(request(FORGED));

    expect(response.status).toBe(422);
    expect(dependencies.report).toHaveBeenCalledWith('logging a suspicious run failed', failure);
  });

  it.each([
    ['Auth', { userOf: () => Promise.reject(new Error('auth down')) }],
    ['the database', { addRun: () => Promise.reject(new Error('db down')) }],
  ])('answers 503 when %s fails, and reports it', async (_, store) => {
    const { submit, dependencies } = setup(store);

    const response = await submit(request(SUBMISSION));

    expect(response.status).toBe(503);
    expect(json(response.body)).toMatchObject({ reason: 'unavailable' });
    expect(dependencies.report).toHaveBeenCalledOnce();
  });

  it('answers 429 with Retry-After when the player has submitted an hour of play this hour', async () => {
    const { submit, dependencies } = setup({
      addRun: () => Promise.resolve({ ok: false, retryAfter: 60 }),
    });

    const response = await submit(request(SUBMISSION));

    expect(response.status).toBe(429);
    expect(response.headers).toMatchObject({ 'retry-after': '60' });
    expect(json(response.body)).toMatchObject({ reason: 'too-many-runs' });
    expect(dependencies.report).not.toHaveBeenCalled();
  });

  it('answers 413 when the compressed replay is still over the 64 KiB a row holds', async () => {
    const { store, dependencies } = setup();
    const huge: SubmitRunDependencies = {
      ...dependencies,
      gzip: () => Promise.resolve(new Uint8Array(65_537)),
    };

    const response = await createSubmitRun(huge)(request(SUBMISSION));

    expect(response.status).toBe(413);
    expect(json(response.body)).toMatchObject({ reason: 'too-large' });
    expect(store.addRun).not.toHaveBeenCalled();
  });
});
