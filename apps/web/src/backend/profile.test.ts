// @vitest-environment node
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import type { Database } from './database.gen';
import { fetchNickname, saveNickname } from './profile';

const URL_ROOT = 'https://abcdefghijklmnopqrst.supabase.co';
const USER = '00000000-0000-4000-8000-00000000000a';

/** The real client, answering the requests in turn, and recording what was asked. */
function clientAnswering(...answers: (() => Response)[]) {
  const fetch = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => {
    const answer = answers.shift();
    return answer === undefined
      ? Promise.reject(new Error('no answer'))
      : Promise.resolve(answer());
  });
  const client = createClient<Database>(URL_ROOT, 'sb_publishable_0123', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  });
  const asked = () =>
    fetch.mock.calls.map(([input, init]) => ({
      url: new URL(input instanceof Request ? input.url : input),
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    }));
  return { client, asked };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('fetchNickname', () => {
  it("reads the player's nickname, or none", async () => {
    const named = clientAnswering(() => json([{ nickname: 'Ann' }]));
    await expect(fetchNickname(named.client, USER)).resolves.toBe('Ann');
    const [request] = named.asked();
    expect(request?.url.pathname).toBe('/rest/v1/profiles');
    expect(Object.fromEntries(request?.url.searchParams ?? [])).toEqual({
      select: 'nickname',
      id: `eq.${USER}`,
      limit: '1',
    });

    const unnamed = clientAnswering(() => json([]));
    await expect(fetchNickname(unnamed.client, USER)).resolves.toBeNull();
  });

  it('throws when the backend cannot answer, for the query to say so', async () => {
    const { client } = clientAnswering(() => json({ message: 'down' }, 503));

    await expect(fetchNickname(client, USER)).rejects.toThrow();
  });
});

describe('saveNickname', () => {
  it('renames the profile the player has', async () => {
    const { client, asked } = clientAnswering(() => json([{ id: USER }]));

    await expect(saveNickname(client, USER, 'Ann')).resolves.toEqual({ ok: true });

    const [update] = asked();
    expect(update?.method).toBe('PATCH');
    expect(Object.fromEntries(update?.url.searchParams ?? [])).toMatchObject({ id: `eq.${USER}` });
    // Only the nickname: a player may not change a profile's id.
    expect(update?.body).toEqual({ nickname: 'Ann' });
  });

  it('creates the profile of a player who has none', async () => {
    const { client, asked } = clientAnswering(
      () => json([]),
      () => new Response(null, { status: 201 }),
    );

    await expect(saveNickname(client, USER, 'Ann')).resolves.toEqual({ ok: true });

    const [, insert] = asked();
    expect(insert?.method).toBe('POST');
    expect(insert?.body).toEqual({ id: USER, nickname: 'Ann' });
  });

  it('says the backend cannot be reached, or did not take the nickname', async () => {
    const down = clientAnswering(() => json({ message: 'down' }, 503));
    await expect(saveNickname(down.client, USER, 'Ann')).resolves.toEqual({
      ok: false,
      problem: 'offline',
    });

    const refused = clientAnswering(() =>
      json({ code: '23514', message: 'violates check constraint' }, 400),
    );
    await expect(saveNickname(refused.client, USER, 'Ann')).resolves.toEqual({
      ok: false,
      problem: 'unavailable',
    });
  });
});
