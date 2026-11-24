/** A session of the backend's auth, as far as the game reads it. */
interface PlayerSession {
  readonly access_token: string;
  readonly user: { readonly id: string };
}

/** An answer of the auth: a session or none, or an error with the HTTP status it came with. */
interface AuthAnswer {
  readonly data: { readonly session: PlayerSession | null };
  readonly error: { readonly status?: number | undefined } | null;
}

/** The part of supabase-js's `auth` the player needs; the real client's `auth` is one. */
export interface PlayerAuth {
  getSession(): Promise<AuthAnswer>;
  signInAnonymously(): Promise<AuthAnswer>;
}

/**
 * Why there is no player:
 * - `signed-out`: this browser has no session, and none was asked for;
 * - `offline`: the backend could not be reached, or the client could not be downloaded;
 * - `unavailable`: the backend answered no, such as anonymous sign-ins turned off or too many of
 *   them from one address.
 */
type PlayerProblem = 'signed-out' | 'offline' | 'unavailable';

type PlayerResult =
  | { readonly ok: true; readonly token: string; readonly userId: string }
  | { readonly ok: false; readonly problem: PlayerProblem };

export interface Player {
  /** The session this browser already has. Never starts one, so it is safe at any time. */
  session(): Promise<PlayerResult>;
  /**
   * The session this browser has, or a new anonymous one (#217). Only sending a run calls it, so
   * nobody gets an account by opening the game. Never answers `signed-out`.
   */
  signIn(): Promise<PlayerResult>;
}

function resultOf({ data, error }: AuthAnswer): PlayerResult {
  if (error !== null) {
    // No status: the request never got an answer. 5xx: a gateway with no project behind it, as
    // while a paused free project wakes up.
    const status = error.status ?? 0;
    return { ok: false, problem: status === 0 || status >= 500 ? 'offline' : 'unavailable' };
  }
  return data.session === null
    ? { ok: false, problem: 'signed-out' }
    : { ok: true, token: data.session.access_token, userId: data.session.user.id };
}

/**
 * The player of this browser, through `load`, which gives the auth of the backend's client and is
 * called on the first question only, never on load. A failed load or a throw counts as offline,
 * and the next question tries again.
 */
export function createPlayer(load: () => Promise<PlayerAuth>): Player {
  let signingIn: Promise<PlayerResult> | null = null;

  const ask = async (question: (auth: PlayerAuth) => Promise<AuthAnswer>) => {
    try {
      return resultOf(await question(await load()));
    } catch {
      return { ok: false, problem: 'offline' } as const;
    }
  };

  const signIn = async (): Promise<PlayerResult> => {
    const current = await ask((auth) => auth.getSession());
    if (current.ok || current.problem !== 'signed-out') {
      return current;
    }
    return ask((auth) => auth.signInAnonymously());
  };

  return {
    session: () => ask((auth) => auth.getSession()),
    signIn() {
      // Two runs that end together would otherwise make two anonymous players.
      signingIn ??= signIn().finally(() => {
        signingIn = null;
      });
      return signingIn;
    },
  };
}
