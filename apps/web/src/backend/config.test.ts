// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { backendConfig } from './config';

const URL = 'https://abcdefghijklmnopqrst.supabase.co';
const KEY = 'sb_publishable_0123456789abcdef';

describe('backendConfig', () => {
  it('reads the project URL and the public key from the environment of the build', () => {
    expect(
      backendConfig({ VITE_SUPABASE_URL: `${URL}/`, VITE_SUPABASE_PUBLISHABLE_KEY: KEY }),
    ).toEqual({ url: URL, key: KEY });
  });

  it('leaves the backend off without either value, as in development, previews and tests', () => {
    expect(backendConfig({})).toBeNull();
    expect(backendConfig({ VITE_SUPABASE_URL: URL })).toBeNull();
    expect(backendConfig({ VITE_SUPABASE_PUBLISHABLE_KEY: KEY })).toBeNull();
    expect(
      backendConfig({ VITE_SUPABASE_URL: ' ', VITE_SUPABASE_PUBLISHABLE_KEY: KEY }),
    ).toBeNull();
  });

  it('takes HTTPS, and plain HTTP only from the local stack', () => {
    const config = (url: string) =>
      backendConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: KEY });

    expect(config('http://127.0.0.1:54321')).toEqual({ url: 'http://127.0.0.1:54321', key: KEY });
    expect(config('http://localhost:54321')).toEqual({ url: 'http://localhost:54321', key: KEY });
    expect(config('http://abcdefghijklmnopqrst.supabase.co')).toBeNull();
    expect(config('not a url')).toBeNull();
    expect(config(`${URL}/rest/v1`)).toBeNull();
  });

  it('never takes a secret key, which must not reach a browser', () => {
    expect(
      backendConfig({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_0123' }),
    ).toBeNull();
  });
});
