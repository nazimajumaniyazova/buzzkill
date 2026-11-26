// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import type { Backend } from './client';
import { PENDING_RUNS_KEY } from './run-queue';
import { createRunUploads } from './run-uploads';

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
  };
}

const backend = {
  config: { url: 'https://abcdefghijklmnopqrst.supabase.co', key: 'sb_publishable_0123' },
  client: () => Promise.reject(new Error('the uploads only need the player')),
  player: {
    session: () => Promise.resolve({ ok: true, token: 'token-1', userId: 'user-1' }),
    signIn: () => Promise.resolve({ ok: true, token: 'token-1', userId: 'user-1' }),
  },
} satisfies Backend;

describe('createRunUploads', () => {
  it('is off in a build without a backend', () => {
    expect(
      createRunUploads({
        backend: null,
        storage: memoryStorage(),
        fetch: () => Promise.reject(new Error('no request without a backend')),
        locks: undefined,
        gameVersion: '1.0.0+test',
      }),
    ).toBeNull();
  });

  it('sends the runs of this version as the player, under the lock of the queue', async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ id: 'run-1' }), { status: 201 })),
    );
    const request = vi.fn();
    const locks = {
      request<T>(name: string, work: () => Promise<T>): Promise<T> {
        request(name, work);
        return work();
      },
    };
    const storage = memoryStorage();

    const uploads = createRunUploads({
      backend,
      storage,
      fetch,
      locks,
      gameVersion: '1.0.0+test',
    });
    uploads?.add('{"replay":1}');

    await expect(uploads?.flush()).resolves.toEqual({ stored: ['run-1'], refused: 0, left: 0 });
    expect(request).toHaveBeenCalledWith(PENDING_RUNS_KEY, expect.any(Function));
    expect(fetch).toHaveBeenCalledWith(
      `${backend.config.url}/functions/v1/submit-run`,
      expect.objectContaining({ body: '{"replay":1}' }),
    );
    expect(JSON.parse(storage.getItem(PENDING_RUNS_KEY) ?? '{}')).toEqual({ version: 1, runs: [] });
  });

  it('keeps the queue to its own tab where the browser has no locks', async () => {
    const uploads = createRunUploads({
      backend,
      storage: memoryStorage(),
      fetch: () => Promise.resolve(new Response(JSON.stringify({ id: 'run-2' }), { status: 201 })),
      locks: undefined,
      gameVersion: '1.0.0+test',
    });
    uploads?.add('{"replay":2}');

    await expect(uploads?.flush()).resolves.toEqual({ stored: ['run-2'], refused: 0, left: 0 });
  });
});
