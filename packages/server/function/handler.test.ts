import { describe, expect, it, vi } from 'vitest';

import type { Fetch, FetchInit } from '../src';
import { createHandler } from './handler';

const GAME_VERSION = '0.35.0';
const PROJECT_URL = 'https://abc.supabase.co';
const PLAYER = '00000000-0000-4000-8000-00000000000a';
const ENV: Record<string, string> = {
  SUPABASE_URL: PROJECT_URL,
  SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_server' }),
};

/** The idle run of `verify.test.ts`: lost after 1526 ticks without a point. */
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

/** Supabase as the store sees it: Auth knows one player, and PostgREST stores every row. */
function fakeSupabase() {
  return vi.fn<Fetch>((url) =>
    Promise.resolve(
      url.endsWith('/auth/v1/user')
        ? reply(200, { id: PLAYER })
        : reply(201, url.includes('/rest/v1/runs') ? [{ id: 'run-1' }] : null),
    ),
  );
}

function reply(status: number, body: unknown) {
  return {
    ok: status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

function handlerWith(fetch: Fetch) {
  return createHandler({
    gameVersion: GAME_VERSION,
    env: (name) => ENV[name],
    fetch,
    now: () => new Date('2026-11-20T12:00:00Z'),
  });
}

function submission(token: string | null): Request {
  return new Request(`${PROJECT_URL}/functions/v1/submit-run`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token === null ? {} : { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ replay: IDLE, claimed: IDLE_RESULT, speed: 1 }),
  });
}

/** The row `fetch` sent to `table`. */
function rowSentTo(fetch: ReturnType<typeof fakeSupabase>, table: string): Record<string, unknown> {
  const call = fetch.mock.calls.find(([url]) => url.includes(`/rest/v1/${table}`));
  if (call === undefined) {
    throw new Error(`nothing was sent to ${table}`);
  }
  const [, init]: [string, FetchInit] = call;
  return JSON.parse(init.body ?? '') as Record<string, unknown>;
}

/** The text of a bytea in PostgREST's hex form, gunzipped. */
async function gunzip(bytea: unknown): Promise<string> {
  const bytes = Uint8Array.from(String(bytea).slice(2).match(/../g) ?? [], (hex) =>
    Number.parseInt(hex, 16),
  );
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

describe('the submit-run function', () => {
  it('answers a preflight request with CORS headers and no body', async () => {
    const response = await handlerWith(fakeSupabase())(
      new Request(`${PROJECT_URL}/functions/v1/submit-run`, { method: 'OPTIONS' }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    await expect(response.text()).resolves.toBe('');
  });

  it('refuses a run sent without a token, as JSON', async () => {
    const fetch = fakeSupabase();

    const response = await handlerWith(fetch)(submission(null));

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toBe('application/json');
    await expect(response.json()).resolves.toMatchObject({ reason: 'unauthorized' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('stores an honest run with its replay gzipped, as the player of the token', async () => {
    const fetch = fakeSupabase();

    const response = await handlerWith(fetch)(submission('player-token'));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: 'run-1',
      ...IDLE_RESULT,
      status: 'lost',
    });
    const row = rowSentTo(fetch, 'runs');
    expect(row).toMatchObject({ user_id: PLAYER, game_version: GAME_VERSION, score: 0 });
    await expect(gunzip(row['replay'])).resolves.toBe(JSON.stringify(IDLE));
  });

  it('reads the project and its server key from the environment when it starts', () => {
    expect(() =>
      createHandler({
        gameVersion: GAME_VERSION,
        env: () => undefined,
        fetch: fakeSupabase(),
        now: () => new Date(),
      }),
    ).toThrow('SUPABASE_URL');
  });
});
