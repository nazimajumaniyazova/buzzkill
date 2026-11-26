// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { contentSecurityPolicy, withContentSecurityPolicy } from './content-security-policy';

const BACKEND = {
  VITE_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_key',
};

const WEBSITE = { VITE_UMAMI_WEBSITE_ID: '6f1c2a40-8d3e-4b5f-9a7c-0e1d2c3b4a59' };

describe('contentSecurityPolicy', () => {
  it('lets a build without a backend or analytics connect only to its own origin', () => {
    expect(contentSecurityPolicy({})).toBe("connect-src 'self'");
  });

  it("adds the backend's own origin, and no other project", () => {
    expect(contentSecurityPolicy(BACKEND)).toBe(
      "connect-src 'self' https://abcdefghijklmnop.supabase.co",
    );
  });

  it('adds the analytics host only for a build that counts', () => {
    expect(contentSecurityPolicy({ ...BACKEND, ...WEBSITE })).toBe(
      "connect-src 'self' https://abcdefghijklmnop.supabase.co https://gateway.umami.is",
    );
  });

  it('leaves out what the app itself would refuse to use', () => {
    expect(
      contentSecurityPolicy({
        VITE_SUPABASE_URL: 'http://abcdefghijklmnop.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_key',
        VITE_UMAMI_WEBSITE_ID: 'not-a-website',
      }),
    ).toBe("connect-src 'self'");
    expect(
      contentSecurityPolicy({ ...BACKEND, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_key' }),
    ).toBe("connect-src 'self'");
  });

  it('allows the local stack of `pnpm db:start` over plain HTTP', () => {
    expect(
      contentSecurityPolicy({
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_key',
      }),
    ).toBe("connect-src 'self' http://127.0.0.1:54321");
  });
});

describe('withContentSecurityPolicy', () => {
  const PAGE = [
    '<!doctype html>',
    '<html lang="en">',
    '  <head>',
    '    <meta charset="UTF-8" />',
    '    <title>Buzzkill</title>',
    '  </head>',
    '</html>',
  ].join('\n');

  it('puts the policy right after the charset, before anything the page loads', () => {
    expect(withContentSecurityPolicy(PAGE, "connect-src 'self'")).toBe(
      [
        '<!doctype html>',
        '<html lang="en">',
        '  <head>',
        '    <meta charset="UTF-8" />',
        `    <meta http-equiv="Content-Security-Policy" content="connect-src &#39;self&#39;" />`,
        '    <title>Buzzkill</title>',
        '  </head>',
        '</html>',
      ].join('\n'),
    );
  });

  it('escapes what would end the attribute', () => {
    expect(withContentSecurityPolicy(PAGE, 'a"b&c<d')).toContain('content="a&quot;b&amp;c&lt;d"');
  });

  it('fails the build of a page without a charset rather than leave the policy out', () => {
    expect(() =>
      withContentSecurityPolicy('<html><head></head></html>', "connect-src 'self'"),
    ).toThrow(/charset/);
  });
});
