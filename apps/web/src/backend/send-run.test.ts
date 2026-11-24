// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import type { Player } from './player';
import { createSendRun } from './send-run';

const CONFIG = { url: 'https://abcdefghijklmnopqrst.supabase.co', key: 'sb_publishable_0123' };
const BODY = '{"replay":{},"claimed":{},"speed":"normal"}';

const signedIn: Pick<Player, 'signIn'> = {
  signIn: () => Promise.resolve({ ok: true, token: 'token-1', userId: 'user-1' }),
};

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

describe('createSendRun', () => {
  it('posts the body to submit-run with the player token and the public key', async () => {
    const fetch = vi.fn(() => Promise.resolve(json(201, { id: 'run-1', score: 10 })));
    const send = createSendRun({ config: CONFIG, player: signedIn, fetch });

    await expect(send(BODY)).resolves.toEqual({ kind: 'stored', id: 'run-1' });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${CONFIG.url}/functions/v1/submit-run`);
    expect(init.method).toBe('POST');
    expect(init.body).toBe(BODY);
    expect(init.headers).toEqual({
      authorization: 'Bearer token-1',
      apikey: CONFIG.key,
      'content-type': 'application/json',
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('keeps the run for later without a player, and sends nothing', async () => {
    const fetch = vi.fn(() => Promise.resolve(json(201, { id: 'run-1' })));
    for (const problem of ['offline', 'unavailable'] as const) {
      const send = createSendRun({
        config: CONFIG,
        player: { signIn: () => Promise.resolve({ ok: false, problem }) },
        fetch,
      });
      await expect(send(BODY)).resolves.toEqual({ kind: 'later' });
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reads the reason of a refusal and the wait of a full hour', async () => {
    const answers = [
      json(422, { reason: 'mismatch', detail: 'the replay does not play to the claim' }),
      json(429, { reason: 'too-many-runs' }, { 'retry-after': '120' }),
    ];
    const send = createSendRun({
      config: CONFIG,
      player: signedIn,
      fetch: () => Promise.resolve(answers.shift() ?? json(500, {})),
    });

    await expect(send(BODY)).resolves.toEqual({ kind: 'refused', reason: 'mismatch' });
    await expect(send(BODY)).resolves.toEqual({ kind: 'later', retryAfter: 120 });
  });

  it('keeps the run for later when the request fails or the answer is not JSON', async () => {
    const failing = createSendRun({
      config: CONFIG,
      player: signedIn,
      fetch: () => Promise.reject(new TypeError('Failed to fetch')),
    });
    await expect(failing(BODY)).resolves.toEqual({ kind: 'later' });

    const gateway = createSendRun({
      config: CONFIG,
      player: signedIn,
      fetch: () => Promise.resolve(new Response('<html>Bad gateway</html>', { status: 502 })),
    });
    await expect(gateway(BODY)).resolves.toEqual({ kind: 'later' });
  });

  it('gives up waiting for an answer after the timeout', async () => {
    vi.useFakeTimers();
    try {
      const send = createSendRun({
        config: CONFIG,
        player: signedIn,
        timeoutMs: 1000,
        fetch: (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () => {
              reject(new Error('aborted', { cause: init.signal.reason }));
            });
          }),
      });
      const outcome = send(BODY);
      await vi.advanceTimersByTimeAsync(1000);
      await expect(outcome).resolves.toEqual({ kind: 'later' });
    } finally {
      vi.useRealTimers();
    }
  });
});
