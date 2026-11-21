/**
 * The entry of the submit-run Edge Function (#218). `pnpm functions:build` bundles it with the
 * backend logic and the game into `supabase/functions/submit-run/index.js`, which Supabase runs.
 */
import { createHandler } from './handler';

/** Set by the bundler to `gameVersion()` of the commit the function is built from. */
declare const __GAME_VERSION__: string;

/** The little of the Deno runtime the function uses; the package carries no Deno types. */
declare const Deno: {
  readonly env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): unknown;
};

Deno.serve(
  createHandler({
    gameVersion: __GAME_VERSION__,
    env: (name) => Deno.env.get(name),
    fetch: (url, init) => fetch(url, init),
    now: () => new Date(),
  }),
);
