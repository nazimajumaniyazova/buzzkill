// @vitest-environment node
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { boardsSourceOf, fetchBoard, fetchPersonalBest } from './boards';
import type { Database } from './database.gen';

const URL_ROOT = 'https://abcdefghijklmnopqrst.supabase.co';

/** The real client, answering every request with `answer` and recording the URLs asked. */
function clientAnswering(answer: () => Response) {
  const fetch = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
    Promise.resolve(answer()),
  );
  const client = createClient<Database>(URL_ROOT, 'sb_publishable_0123', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  });
  const asked = (): URL[] =>
    fetch.mock.calls.map(([input]) => new URL(input instanceof Request ? input.url : input));
  return { client, asked };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: '00000000-0000-4000-8000-00000000000a',
  nickname: 'Ann',
  score: 900,
  level: 4,
  created_at: '2026-11-23T10:00:00+00:00',
};

describe('fetchBoard', () => {
  it('reads the top 10 of a difficulty, by score and the earlier run first', async () => {
    const { client, asked } = clientAnswering(() => json([ROW]));

    await expect(fetchBoard(client, { mode: 'classic', difficulty: 'hard' })).resolves.toEqual([
      {
        id: ROW.id,
        userId: ROW.user_id,
        nickname: 'Ann',
        score: 900,
        level: 4,
        createdAt: ROW.created_at,
      },
    ]);

    const [url] = asked();
    expect(url?.pathname).toBe('/rest/v1/best_runs');
    expect(Object.fromEntries(url?.searchParams ?? [])).toEqual({
      select: 'id,user_id,nickname,score,level,created_at',
      mode: 'eq.classic',
      difficulty: 'eq.hard',
      order: 'score.desc,created_at.asc',
      limit: '10',
    });
  });

  it('reads the board of a day of the daily challenge', async () => {
    const { client, asked } = clientAnswering(() => json([]));

    await expect(fetchBoard(client, { mode: 'daily', day: '2026-11-24' })).resolves.toEqual([]);

    expect(Object.fromEntries(asked()[0]?.searchParams ?? [])).toMatchObject({
      mode: 'eq.daily',
      daily_date: 'eq.2026-11-24',
    });
  });

  it('keeps a player without a nickname, and leaves out a row it cannot read', async () => {
    const { client } = clientAnswering(() =>
      json([
        { ...ROW, nickname: null },
        { ...ROW, score: 'lots' },
        { ...ROW, id: null },
      ]),
    );

    const rows = await fetchBoard(client, { mode: 'classic', difficulty: 'normal' });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.nickname).toBeNull();
  });

  it('throws at once when the backend answers with an error, for the query to show it', async () => {
    const { client, asked } = clientAnswering(() => json({ message: 'unavailable' }, 503));

    await expect(fetchBoard(client, { mode: 'classic', difficulty: 'easy' })).rejects.toThrow();
    // Once: the query decides when to try again, not the client as well.
    expect(asked()).toHaveLength(1);
  });
});

describe('fetchPersonalBest', () => {
  it("reads the player's best run of the board at any speed, with its speed", async () => {
    const { client, asked } = clientAnswering(() => json([{ ...ROW, speed: 75 }]));

    await expect(
      fetchPersonalBest(client, ROW.user_id, { mode: 'classic', difficulty: 'normal' }),
    ).resolves.toEqual({
      id: ROW.id,
      userId: ROW.user_id,
      score: 900,
      level: 4,
      createdAt: ROW.created_at,
      speed: 75,
    });

    const [url] = asked();
    expect(url?.pathname).toBe('/rest/v1/runs');
    expect(Object.fromEntries(url?.searchParams ?? [])).toEqual({
      select: 'id,user_id,score,level,created_at,speed',
      user_id: `eq.${ROW.user_id}`,
      mode: 'eq.classic',
      difficulty: 'eq.normal',
      order: 'score.desc,created_at.asc',
      limit: '1',
    });
  });

  it('is null when the player has no run on the board', async () => {
    const { client } = clientAnswering(() => json([]));

    await expect(
      fetchPersonalBest(client, ROW.user_id, { mode: 'daily', day: '2026-11-24' }),
    ).resolves.toBeNull();
  });
});

describe('boardsSourceOf', () => {
  it('reads the boards and the record of the player this browser already has', async () => {
    const { client, asked } = clientAnswering(() => json([{ ...ROW, speed: 100 }]));
    const signIn = vi.fn();
    const source = boardsSourceOf({
      client: () => Promise.resolve(client),
      player: {
        session: () => Promise.resolve({ ok: true, token: 'token-1', userId: ROW.user_id }),
        signIn,
      },
    });

    await expect(source.board({ mode: 'classic', difficulty: 'easy' })).resolves.toHaveLength(1);
    await expect(
      source.personalBest({ mode: 'classic', difficulty: 'easy' }),
    ).resolves.toMatchObject({ userId: ROW.user_id, best: { score: 900, speed: 100 } });
    expect(asked().map((url) => url.pathname)).toEqual(['/rest/v1/best_runs', '/rest/v1/runs']);
    // Looking at the boards never makes anyone a player (#217).
    expect(signIn).not.toHaveBeenCalled();
  });

  it("reads and saves the player's nickname, and has none without a session (#217)", async () => {
    const { client, asked } = clientAnswering(() => json([{ nickname: 'Ann' }]));
    const signIn = vi.fn();
    const source = boardsSourceOf({
      client: () => Promise.resolve(client),
      player: {
        session: () => Promise.resolve({ ok: true, token: 'token-1', userId: ROW.user_id }),
        signIn,
      },
    });
    await expect(source.profile()).resolves.toEqual({ userId: ROW.user_id, nickname: 'Ann' });
    expect(asked().map((url) => url.pathname)).toEqual(['/rest/v1/profiles']);

    const signedOut = clientAnswering(() => json([]));
    const nobody = boardsSourceOf({
      client: () => Promise.resolve(signedOut.client),
      player: {
        session: () => Promise.resolve({ ok: false, problem: 'signed-out' }),
        signIn,
      },
    });
    await expect(nobody.profile()).resolves.toBeNull();
    // A nickname needs a player, and picking one never makes one: runs do (#217).
    await expect(nobody.saveNickname('Ann')).resolves.toEqual({
      ok: false,
      problem: 'unavailable',
    });
    expect(signedOut.asked()).toEqual([]);
    expect(signIn).not.toHaveBeenCalled();
  });

  it('has no record without a session, and asks the backend nothing for it', async () => {
    const { client, asked } = clientAnswering(() => json([]));
    const source = boardsSourceOf({
      client: () => Promise.resolve(client),
      player: {
        session: () => Promise.resolve({ ok: false, problem: 'signed-out' }),
        signIn: vi.fn(),
      },
    });

    await expect(source.personalBest({ mode: 'daily', day: '2026-11-24' })).resolves.toEqual({
      userId: null,
      best: null,
    });
    expect(asked()).toEqual([]);
  });

  it('fails the record when the session cannot be read, as offline', async () => {
    const { client } = clientAnswering(() => json([]));
    const source = boardsSourceOf({
      client: () => Promise.resolve(client),
      player: {
        session: () => Promise.resolve({ ok: false, problem: 'offline' }),
        signIn: vi.fn(),
      },
    });

    await expect(source.personalBest({ mode: 'daily', day: '2026-11-24' })).rejects.toThrow();
  });
});
