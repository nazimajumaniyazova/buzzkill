// @vitest-environment node
import { noProgress } from '@buzzkill/game';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { createAchievementSync } from './achievement-sync';
import type { Database } from './database.gen';

const URL_ROOT = 'https://abcdefghijklmnopqrst.supabase.co';
const USER = '00000000-0000-4000-8000-00000000000a';
const FIRST = '2026-11-23T10:00:00.000Z';
const LATER = '2026-11-24T08:30:00.000Z';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** A backend whose real client answers every request with `answer`, and records them. */
function backendAnswering(answer: () => Response, signedIn = true) {
  const fetch = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
    Promise.resolve(answer()),
  );
  const client = createClient<Database>(URL_ROOT, 'sb_publishable_0123', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  });
  const backend = {
    client: vi.fn(() => Promise.resolve(client)),
    player: {
      session: vi.fn(() =>
        Promise.resolve(
          signedIn
            ? ({ ok: true, token: 'token', userId: USER } as const)
            : ({ ok: false, problem: 'signed-out' } as const),
        ),
      ),
      signIn: vi.fn(),
    },
  };
  return { backend, fetch };
}

const DEVICE = {
  progress: { ...noProgress(), firstSwat: 1, swatter: 4 },
  unlockedAt: { firstSwat: FIRST },
};

describe('createAchievementSync', () => {
  it("sends what the device unlocked and reads back the account's set", async () => {
    const { backend, fetch } = backendAnswering(() =>
      json([
        { user_id: USER, achievement_id: 'firstSwat', unlocked_at: '2026-11-23T10:00:00+00:00' },
        { user_id: USER, achievement_id: 'regicide', unlocked_at: '2026-11-24T08:30:00+00:00' },
      ]),
    );

    await expect(createAchievementSync(backend)(DEVICE)).resolves.toEqual({
      kind: 'merged',
      account: [
        { id: 'firstSwat', unlockedAt: FIRST },
        { id: 'regicide', unlockedAt: LATER },
      ],
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [input, init] = fetch.mock.calls[0] ?? [];
    const url = new URL(input instanceof Request ? input.url : String(input));
    expect(url.pathname).toBe('/rest/v1/rpc/merge_achievements');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '')).toEqual({
      unlocked: [{ achievement_id: 'firstSwat', unlocked_at: FIRST }],
    });
    // Looking for a session never makes anyone a player (#217).
    expect(backend.player.signIn).not.toHaveBeenCalled();
  });

  it('leaves out rows the game cannot read: an achievement of another version, a bad time', async () => {
    const { backend } = backendAnswering(() =>
      json([
        { user_id: USER, achievement_id: 'retired', unlocked_at: FIRST },
        { user_id: USER, achievement_id: 'regicide', unlocked_at: 'soon' },
        { user_id: USER, achievement_id: 'firstSwat', unlocked_at: FIRST },
        'not a row',
      ]),
    );

    await expect(createAchievementSync(backend)(DEVICE)).resolves.toEqual({
      kind: 'merged',
      account: [{ id: 'firstSwat', unlockedAt: FIRST }],
    });
  });

  it('asks nothing of a browser that has no player', async () => {
    const { backend, fetch } = backendAnswering(() => json([]), false);

    await expect(createAchievementSync(backend)(DEVICE)).resolves.toEqual({ kind: 'skipped' });
    expect(backend.client).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('gives a failure, never a throw, when the backend says no or cannot be reached', async () => {
    const refused = backendAnswering(() => json({ code: '28000', message: 'no' }, 401));
    await expect(createAchievementSync(refused.backend)(DEVICE)).resolves.toEqual({
      kind: 'failed',
    });

    const offline = backendAnswering(() => {
      throw new TypeError('Failed to fetch');
    });
    await expect(createAchievementSync(offline.backend)(DEVICE)).resolves.toEqual({
      kind: 'failed',
    });

    const noClient = backendAnswering(() => json([]));
    noClient.backend.client.mockRejectedValueOnce(new Error('chunk failed'));
    await expect(createAchievementSync(noClient.backend)(DEVICE)).resolves.toEqual({
      kind: 'failed',
    });
  });
});
