// @vitest-environment node
import { type Replay, REPLAY_FORMAT_VERSION, serializeReplay } from '@buzzkill/game';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import type { Database } from './database.gen';
import { fetchReplay } from './replays';

const URL_ROOT = 'https://abcdefghijklmnopqrst.supabase.co';
const RUN_ID = '11111111-1111-4111-8111-111111111111';
const VERSION = '0.43.0+0123456789ab';

const REPLAY: Replay = {
  formatVersion: REPLAY_FORMAT_VERSION,
  gameVersion: VERSION,
  seed: 7,
  heroId: 'female',
  mode: 'night',
  difficulty: 'hard',
  daily: null,
  inputs: [12, 1, 30, 0],
};

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

/** `text` gzipped, as a bytea reads in PostgREST's JSON: `\x` and the bytes in hex. */
async function storedBytes(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return `\\x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

describe('fetchReplay', () => {
  it('reads the replay of a run by its id, unzipped and checked', async () => {
    const replay = await storedBytes(serializeReplay(REPLAY));
    const { client, asked } = clientAnswering(() => json([{ game_version: VERSION, replay }]));

    await expect(fetchReplay(client, RUN_ID, VERSION)).resolves.toEqual({
      ok: true,
      replay: REPLAY,
    });

    const [url] = asked();
    expect(url?.pathname).toBe('/rest/v1/runs');
    expect(Object.fromEntries(url?.searchParams ?? [])).toEqual({
      select: 'game_version,replay',
      id: `eq.${RUN_ID}`,
      limit: '1',
    });
  });

  it('says a run that is not there, or an id that is not one, is not found', async () => {
    const { client, asked } = clientAnswering(() => json([]));

    await expect(fetchReplay(client, RUN_ID, VERSION)).resolves.toEqual({
      ok: false,
      problem: 'not-found',
    });
    await expect(fetchReplay(client, 'not-a-run', VERSION)).resolves.toEqual({
      ok: false,
      problem: 'not-found',
    });
    // An id that cannot be one is not asked for.
    expect(asked()).toHaveLength(1);
  });

  it('refuses a run of another version of the game: it would not play the same', async () => {
    const replay = await storedBytes(serializeReplay({ ...REPLAY, gameVersion: '0.40.0+old' }));
    const { client } = clientAnswering(() => json([{ game_version: '0.40.0+old', replay }]));

    await expect(fetchReplay(client, RUN_ID, VERSION)).resolves.toEqual({
      ok: false,
      problem: 'other-version',
    });
  });

  it('says what cannot be read is unreadable: no hex, no gzip, no replay', async () => {
    const answers = [
      { game_version: VERSION, replay: 'plain text' },
      { game_version: VERSION, replay: '\\x0102030405' },
      { game_version: VERSION, replay: await storedBytes('{"formatVersion": 99}') },
    ];
    for (const row of answers) {
      const { client } = clientAnswering(() => json([row]));
      await expect(fetchReplay(client, RUN_ID, VERSION)).resolves.toEqual({
        ok: false,
        problem: 'unreadable',
      });
    }
  });

  it('says the backend cannot be reached after one request, not three', async () => {
    const { client, asked } = clientAnswering(() => json({ message: 'down' }, 503));

    await expect(fetchReplay(client, RUN_ID, VERSION)).resolves.toEqual({
      ok: false,
      problem: 'offline',
    });
    expect(asked()).toHaveLength(1);
  });
});
