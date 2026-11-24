// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { createPlayer, type PlayerAuth } from './player';

type Answer = Awaited<ReturnType<PlayerAuth['getSession']>>;

const session = (id: string) => ({ access_token: `token-${id}`, user: { id } });
const signedIn = (id: string): Answer => ({ data: { session: session(id) }, error: null });
const signedOut: Answer = { data: { session: null }, error: null };
const failed = (status?: number): Answer => ({
  data: { session: null },
  error: status === undefined ? {} : { status },
});

/** An auth whose session is `current`, and whose anonymous sign-in answers `anonymous`. */
function fakeAuth(current: Answer, anonymous: Answer = signedIn('new')) {
  return {
    getSession: vi.fn(() => Promise.resolve(current)),
    signInAnonymously: vi.fn(() => Promise.resolve(anonymous)),
  } satisfies PlayerAuth;
}

describe('createPlayer', () => {
  it('loads nothing and signs no one in until it is asked', () => {
    const load = vi.fn(() => Promise.resolve(fakeAuth(signedOut)));

    createPlayer(load);

    expect(load).not.toHaveBeenCalled();
  });

  it('gives the token of the session this browser has, without starting one', async () => {
    const auth = fakeAuth(signedIn('mike'));
    const player = createPlayer(() => Promise.resolve(auth));

    expect(await player.session()).toEqual({ ok: true, token: 'token-mike', userId: 'mike' });
    expect(await player.signIn()).toEqual({ ok: true, token: 'token-mike', userId: 'mike' });
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('reads no session as signed out, and starts an anonymous one only to sign in', async () => {
    const auth = fakeAuth(signedOut);
    const player = createPlayer(() => Promise.resolve(auth));

    expect(await player.session()).toEqual({ ok: false, problem: 'signed-out' });
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    expect(await player.signIn()).toEqual({ ok: true, token: 'token-new', userId: 'new' });
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('starts one anonymous session for two sign-ins at once', async () => {
    const auth = fakeAuth(signedOut);
    const player = createPlayer(() => Promise.resolve(auth));

    const [first, second] = await Promise.all([player.signIn(), player.signIn()]);

    expect(first).toEqual(second);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('tells a backend it cannot reach from one that says no', async () => {
    const signIn = (anonymous: Answer) =>
      createPlayer(() => Promise.resolve(fakeAuth(signedOut, anonymous))).signIn();

    // No answer, or a gateway that has none: the network, or a project paused or restarting.
    expect(await signIn(failed())).toEqual({ ok: false, problem: 'offline' });
    expect(await signIn(failed(0))).toEqual({ ok: false, problem: 'offline' });
    expect(await signIn(failed(503))).toEqual({ ok: false, problem: 'offline' });
    // Anonymous sign-ins turned off, or too many from this address.
    expect(await signIn(failed(422))).toEqual({ ok: false, problem: 'unavailable' });
    expect(await signIn(failed(429))).toEqual({ ok: false, problem: 'unavailable' });
  });

  it('reads a client that does not download, or that throws, as offline, and tries again', async () => {
    const load = vi
      .fn<() => Promise<PlayerAuth>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'))
      .mockResolvedValue(fakeAuth(signedIn('mike')));
    const player = createPlayer(load);

    expect(await player.signIn()).toEqual({ ok: false, problem: 'offline' });
    expect(await player.signIn()).toEqual({ ok: true, token: 'token-mike', userId: 'mike' });

    const throwing = createPlayer(() =>
      Promise.resolve({
        getSession: () => Promise.reject(new TypeError('Failed to fetch')),
        signInAnonymously: () => Promise.reject(new TypeError('Failed to fetch')),
      }),
    );
    expect(await throwing.session()).toEqual({ ok: false, problem: 'offline' });
  });
});
