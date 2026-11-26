import type { Plugin } from 'vite';

import { ANALYTICS_ENDPOINT, websiteIdOf } from '../src/analytics/analytics';
import { backendConfig } from '../src/backend/config';

type BuildEnv = Readonly<Record<string, unknown>>;

/**
 * The content security policy of a build (ADR-0019): the page may connect to its own origin, to
 * the build's Supabase project and to the analytics host, and nowhere else. A host is listed only
 * when the app itself would use it: the same checks decide, so a preview without a backend and a
 * build without a website id allow neither.
 *
 * Only `connect-src` for now; stage 10 builds the strict policy around it. The game's images and
 * sounds are files of the build, never inlined as `data:` URLs: a fetch of one would be refused,
 * and the end-to-end tests, which play a built game, would fail.
 */
export function contentSecurityPolicy(env: BuildEnv): string {
  const sources = ["'self'"];
  const backend = backendConfig(env);
  if (backend !== null) {
    sources.push(backend.url);
  }
  if (websiteIdOf(env) !== null) {
    sources.push(new URL(ANALYTICS_ENDPOINT).origin);
  }
  return `connect-src ${sources.join(' ')}`;
}

/** The `<meta charset>` of the page: the policy goes right after it. */
const CHARSET = /<meta charset="[^"]*"\s*\/?>/i;

const ATTRIBUTE_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '"': '&quot;',
  "'": '&#39;',
  '<': '&lt;',
  '>': '&gt;',
};

/**
 * The page with the policy as a `<meta>` right after its charset. A meta tag rather than a header
 * in `vercel.json`: the hosts come from the environment of each build, which a static header
 * cannot follow, and a production build and a preview have different ones.
 *
 * The tag precedes every script and stylesheet, and it comes after the charset, which a browser
 * looks for only in the first 1024 bytes of the page, however long the policy grows.
 */
export function withContentSecurityPolicy(html: string, policy: string): string {
  const charset = CHARSET.exec(html);
  if (charset === null) {
    throw new Error('index.html has no <meta charset>, after which the security policy goes.');
  }
  const content = policy.replace(/[&"'<>]/g, (character) => ATTRIBUTE_ESCAPES[character] ?? '');
  const indent = /[ \t]*$/.exec(html.slice(0, charset.index))?.[0] ?? '';
  const end = charset.index + charset[0].length;
  const tag = `<meta http-equiv="Content-Security-Policy" content="${content}" />`;
  return `${html.slice(0, end)}\n${indent}${tag}${html.slice(end)}`;
}

/**
 * Writes the policy into the built `index.html`. Only builds: the development server's hot reload
 * connects over a WebSocket of its own.
 */
export function contentSecurityPolicyPlugin(): Plugin {
  let env: BuildEnv = {};
  return {
    name: 'buzzkill:content-security-policy',
    apply: 'build',
    configResolved(config) {
      env = config.env;
    },
    transformIndexHtml(html) {
      return withContentSecurityPolicy(html, contentSecurityPolicy(env));
    },
  };
}
