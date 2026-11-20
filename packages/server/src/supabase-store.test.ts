import { describe, expect, it, vi } from 'vitest';

import {
  createSupabaseStore,
  type Fetch,
  type FetchInit,
  supabaseConfigFromEnv,
} from './supabase-store';
import type { VerifiedRun } from './verify';

const PROJECT_URL = 'https://abc.supabase.co';
const SECRET = 'sb_secret_server';
const PLAYER = '00000000-0000-4000-8000-00000000000a';

const RUN: VerifiedRun = {
  mode: 'daily',
  dailyDate: '2026-11-20',
  difficulty: 'normal',
  heroId: 'female',
  timeOfDay: 'day',
  speed: 100,
  gameVersion: '0.36.0+5c06cad63ac3',
  seed: 2026,
  score: 1200,
  level: 2,
  ticks: 5000,
  status: 'lost',
  stateHash: '0a1b2c3d',
  replay: '{"formatVersion":3}',
};

/** A fetch that answers every call with `status` and `body`, and remembers the calls. */
function fakeFetch(status: number, body: unknown = null) {
  return vi.fn<Fetch>(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    }),
  );
}

function callOf(fetch: ReturnType<typeof fakeFetch>): [string, FetchInit] {
  const call = fetch.mock.calls[0];
  if (call === undefined) {
    throw new Error('fetch was not called');
  }
  return call;
}

describe('the Supabase store', () => {
  describe('userOf', () => {
    it('asks Auth for the player of a token', async () => {
      const fetch = fakeFetch(200, { id: PLAYER, is_anonymous: true });
      const store = createSupabaseStore({ url: PROJECT_URL, key: SECRET, fetch });

      await expect(store.userOf('player-token')).resolves.toBe(PLAYER);

      const [url, init] = callOf(fetch);
      expect(url).toBe(`${PROJECT_URL}/auth/v1/user`);
      expect(init.method).toBe('GET');
      expect(init.headers).toMatchObject({ apikey: SECRET, authorization: 'Bearer player-token' });
    });

    it.each([401, 403])('finds no player when Auth answers %i', async (status) => {
      const store = createSupabaseStore({
        url: PROJECT_URL,
        key: SECRET,
        fetch: fakeFetch(status),
      });

      await expect(store.userOf('expired')).resolves.toBeNull();
    });

    it('fails when Auth fails, or answers without an id', async () => {
      const down = createSupabaseStore({ url: PROJECT_URL, key: SECRET, fetch: fakeFetch(500) });
      const odd = createSupabaseStore({ url: PROJECT_URL, key: SECRET, fetch: fakeFetch(200, {}) });

      await expect(down.userOf('player-token')).rejects.toThrow('Auth answered 500');
      await expect(odd.userOf('player-token')).rejects.toThrow();
    });
  });

  describe('addRun', () => {
    it('inserts the run as a row of runs and answers with its id', async () => {
      const fetch = fakeFetch(201, [{ id: 'run-1' }]);
      const store = createSupabaseStore({ url: `${PROJECT_URL}/`, key: SECRET, fetch });

      await expect(store.addRun(PLAYER, RUN, Uint8Array.of(0x1f, 0x8b, 0x00))).resolves.toBe(
        'run-1',
      );

      const [url, init] = callOf(fetch);
      expect(url).toBe(`${PROJECT_URL}/rest/v1/runs?select=id`);
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({
        apikey: SECRET,
        'content-type': 'application/json',
        prefer: 'return=representation',
      });
      expect(JSON.parse(init.body ?? '')).toEqual({
        user_id: PLAYER,
        mode: 'daily',
        daily_date: '2026-11-20',
        difficulty: 'normal',
        hero_id: 'female',
        time_of_day: 'day',
        speed: 100,
        game_version: '0.36.0+5c06cad63ac3',
        seed: 2026,
        score: 1200,
        level: 2,
        ticks: 5000,
        status: 'lost',
        state_hash: '0a1b2c3d',
        // PostgREST reads a bytea from its hex form.
        replay: '\\x1f8b00',
      });
    });

    it('fails with the status and the answer of PostgREST', async () => {
      const store = createSupabaseStore({
        url: PROJECT_URL,
        key: SECRET,
        fetch: fakeFetch(400, { message: 'violates check constraint' }),
      });

      await expect(store.addRun(PLAYER, RUN, Uint8Array.of(0))).rejects.toThrow(
        /PostgREST answered 400: .*violates check constraint/,
      );
    });
  });

  describe('logSuspicious', () => {
    it('inserts the attempt as a row of suspicious_runs', async () => {
      const fetch = fakeFetch(201);
      const store = createSupabaseStore({ url: PROJECT_URL, key: SECRET, fetch });
      const claimed = { score: 9999, level: 6, ticks: 1526, hash: '105607ed' };
      const found = { score: 0, level: 1, ticks: 1526, hash: '105607ed' };

      await store.logSuspicious({
        userId: PLAYER,
        gameVersion: '0.36.0',
        seed: 7,
        claimed,
        found,
        replay: Uint8Array.of(0xab),
      });

      const [url, init] = callOf(fetch);
      expect(url).toBe(`${PROJECT_URL}/rest/v1/suspicious_runs`);
      expect(init.headers).toMatchObject({ prefer: 'return=minimal' });
      expect(JSON.parse(init.body ?? '')).toEqual({
        user_id: PLAYER,
        game_version: '0.36.0',
        seed: 7,
        claimed,
        found,
        replay: '\\xab',
      });
    });

    it('fails when PostgREST fails', async () => {
      const store = createSupabaseStore({ url: PROJECT_URL, key: SECRET, fetch: fakeFetch(503) });

      await expect(
        store.logSuspicious({
          userId: PLAYER,
          gameVersion: '0.36.0',
          seed: 7,
          claimed: { score: 1, level: 1, ticks: 1, hash: '00000000' },
          found: { score: 0, level: 1, ticks: 1, hash: '00000000' },
          replay: Uint8Array.of(0),
        }),
      ).rejects.toThrow('PostgREST answered 503');
    });
  });

  it('sends a secret key only as apikey, and a legacy JWT key as the bearer too', async () => {
    const secretFetch = fakeFetch(201, [{ id: 'run-1' }]);
    const legacyFetch = fakeFetch(201, [{ id: 'run-1' }]);

    await createSupabaseStore({ url: PROJECT_URL, key: SECRET, fetch: secretFetch }).addRun(
      PLAYER,
      RUN,
      Uint8Array.of(0),
    );
    await createSupabaseStore({
      url: PROJECT_URL,
      key: 'eyJ.legacy.jwt',
      fetch: legacyFetch,
    }).addRun(PLAYER, RUN, Uint8Array.of(0));

    expect(callOf(secretFetch)[1].headers).not.toHaveProperty('authorization');
    expect(callOf(legacyFetch)[1].headers).toMatchObject({
      apikey: 'eyJ.legacy.jwt',
      authorization: 'Bearer eyJ.legacy.jwt',
    });
  });
});

describe('supabaseConfigFromEnv', () => {
  const env =
    (values: Record<string, string>) =>
    (name: string): string | undefined =>
      values[name];

  it('prefers the default secret key over the legacy service role key', () => {
    expect(
      supabaseConfigFromEnv(
        env({
          SUPABASE_URL: PROJECT_URL,
          SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET, other: 'sb_secret_other' }),
          SUPABASE_SERVICE_ROLE_KEY: 'eyJ.legacy.jwt',
        }),
      ),
    ).toEqual({ url: PROJECT_URL, key: SECRET });
  });

  it('falls back to the legacy service role key', () => {
    expect(
      supabaseConfigFromEnv(
        env({ SUPABASE_URL: PROJECT_URL, SUPABASE_SERVICE_ROLE_KEY: 'eyJ.legacy.jwt' }),
      ),
    ).toEqual({ url: PROJECT_URL, key: 'eyJ.legacy.jwt' });
  });

  it.each([
    ['no PROJECT_URL', { SUPABASE_SERVICE_ROLE_KEY: 'eyJ.legacy.jwt' }],
    ['no key', { SUPABASE_URL: PROJECT_URL }],
    [
      'secret keys without a default',
      { SUPABASE_URL: PROJECT_URL, SUPABASE_SECRET_KEYS: '{"other":"x"}' },
    ],
  ])('fails with %s', (_, values) => {
    expect(() => supabaseConfigFromEnv(env(values))).toThrow();
  });
});
