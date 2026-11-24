/** Where the backend is: the project's URL and its public key (ADR-0007). */
export interface BackendConfig {
  readonly url: string;
  readonly key: string;
}

/** Hosts that may serve the backend over plain HTTP: the local stack of `pnpm db:start`. */
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

/**
 * The backend of this build, from `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, or
 * `null` when it has none: development, previews, tests and end-to-end runs play without one.
 *
 * The URL is the project's root, over HTTPS but on the local stack. A secret key is refused: it
 * bypasses Row Level Security, and anything a build is given ships to every browser.
 */
export function backendConfig(env: Readonly<Record<string, unknown>>): BackendConfig | null {
  const url = env['VITE_SUPABASE_URL'];
  const key = env['VITE_SUPABASE_PUBLISHABLE_KEY'];
  if (typeof url !== 'string' || typeof key !== 'string') {
    return null;
  }
  const trimmedKey = key.trim();
  if (trimmedKey === '' || trimmedKey.startsWith('sb_secret_')) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  const secure =
    parsed.protocol === 'https:' ||
    (parsed.protocol === 'http:' && LOCAL_HOSTS.has(parsed.hostname));
  if (!secure || parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '') {
    return null;
  }
  return { url: parsed.origin, key: trimmedKey };
}
