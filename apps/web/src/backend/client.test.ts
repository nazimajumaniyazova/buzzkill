// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { createBackend, type SupabaseModule } from './client';

const config = { url: 'https://abcdefghijklmnopqrst.supabase.co', key: 'sb_publishable_0123' };

/** The module of supabase-js, with a client that only knows it was made. */
function fakeModule() {
  const auth = {
    getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInAnonymously: vi.fn(),
  };
  const createClient = vi.fn((..._args: unknown[]) => ({ auth }));
  // The fake has only what the backend calls; the real client has far more.
  return { module: { createClient } as unknown as SupabaseModule, createClient, auth };
}

describe('createBackend', () => {
  it('downloads the client only when something asks for it, and makes it once', async () => {
    const { module, createClient } = fakeModule();
    const load = vi.fn(() => Promise.resolve(module));
    const backend = createBackend(config, load);
    expect(load).not.toHaveBeenCalled();
    // The sender of runs needs the project's URL and key too (#220).
    expect(backend.config).toEqual(config);

    const [first, second] = await Promise.all([backend.client(), backend.client()]);

    expect(first).toBe(second);
    expect(load).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(config.url, config.key, {
      auth: {
        storageKey: 'buzzkill.auth',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  });

  it('downloads it again after a failed download', async () => {
    const { module } = fakeModule();
    const load = vi
      .fn<() => Promise<SupabaseModule>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'))
      .mockResolvedValue(module);
    const backend = createBackend(config, load);

    await expect(backend.client()).rejects.toThrow(TypeError);
    await expect(backend.client()).resolves.toBeDefined();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("gives the player through the client's auth", async () => {
    const { module, auth } = fakeModule();
    const backend = createBackend(config, () => Promise.resolve(module));

    expect(await backend.player.session()).toEqual({ ok: false, problem: 'signed-out' });
    expect(auth.getSession).toHaveBeenCalledTimes(1);
  });
});
