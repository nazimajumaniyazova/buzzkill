/**
 * Plays runs through the submit-run function of a running Supabase stack, as the web app of the
 * same commit would send them (#218). CI's Database job runs it against the local stack after
 * `pnpm functions:build`; it reads the stack from the environment:
 *
 * - `SUPABASE_URL`: the API gateway, such as `http://127.0.0.1:54321`;
 * - `SUPABASE_PUBLISHABLE_KEY`: the key the browser sends;
 * - `SUPABASE_SECRET_KEY`: the server key, to read back what the function stored and to fill
 *   a player's hour with play for the limit of #235.
 *
 * The honest run carries `gameVersion()` of this checkout, the version the web build declares,
 * so it is stored only when the function was bundled from the same sources.
 */
import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { gameVersion } from '@buzzkill/config/game-version';
import { parseReplay, type Replay, REPLAY_FORMAT_VERSION, simulate } from '@buzzkill/game';

import { MAX_RUN_TICKS } from '../src';

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`${name} is not set`);
  }
  return value;
}

const API = required('SUPABASE_URL').replace(/\/+$/, '');
const PUBLISHABLE_KEY = required('SUPABASE_PUBLISHABLE_KEY');
const SECRET_KEY = required('SUPABASE_SECRET_KEY');
const FUNCTION = `${API}/functions/v1/submit-run`;

/** A new key goes only in `apikey`; a legacy one is a JWT that PostgREST also wants as bearer. */
const SERVER_HEADERS: Record<string, string> = SECRET_KEY.startsWith('sb_')
  ? { apikey: SECRET_KEY }
  : { apikey: SECRET_KEY, authorization: `Bearer ${SECRET_KEY}` };

function step(message: string): void {
  process.stdout.write(`- ${message}\n`);
}

/** The edge runtime boots the function on its first request; wait until it answers. */
async function waitForFunction(): Promise<void> {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const response = await fetch(FUNCTION, { method: 'OPTIONS' }).catch(() => null);
    if (response?.status === 204) {
      return;
    }
    await sleep(2000);
  }
  throw new Error(`${FUNCTION} did not answer a preflight request within a minute`);
}

async function signInAnonymously(): Promise<{ token: string; userId: string }> {
  const response = await fetch(`${API}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(response.status, 200, `anonymous sign-in: ${await response.clone().text()}`);
  const session = (await response.json()) as { access_token: string; user: { id: string } };
  return { token: session.access_token, userId: session.user.id };
}

async function submit(token: string | null, body: object): Promise<Response> {
  return fetch(FUNCTION, {
    method: 'POST',
    headers: {
      apikey: PUBLISHABLE_KEY,
      'content-type': 'application/json',
      ...(token === null ? {} : { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });
}

async function rows(table: string, query: string): Promise<Record<string, unknown>[]> {
  const response = await fetch(`${API}/rest/v1/${table}?${query}`, { headers: SERVER_HEADERS });
  assert.equal(response.status, 200, `reading ${table}: ${await response.clone().text()}`);
  return (await response.json()) as Record<string, unknown>[];
}

/** Stores `runs` through the server key, as the function would, without playing them. */
async function storeRuns(runs: readonly object[]): Promise<void> {
  const response = await fetch(`${API}/rest/v1/runs`, {
    method: 'POST',
    headers: { ...SERVER_HEADERS, 'content-type': 'application/json', prefer: 'return=minimal' },
    body: JSON.stringify(runs),
  });
  assert.equal(response.status, 201, `storing runs: ${await response.clone().text()}`);
}

/** The play a player's runs of the last hour may hold (#235): an hour of ticks and one run. */
const HOUR_LIMIT = 3600 * 60 + MAX_RUN_TICKS;

const version = gameVersion(join(import.meta.dirname, '../../..'));
// The hero never moves or fires: the run is lost in about 25 seconds of game time.
const replay: Replay = {
  formatVersion: REPLAY_FORMAT_VERSION,
  gameVersion: version,
  seed: 2026,
  heroId: 'male',
  mode: 'day',
  difficulty: 'normal',
  daily: null,
  inputs: [],
};
const parsed = parseReplay(replay);
assert.ok(parsed.ok);
const { score, level, ticks, hash } = simulate(parsed.replay, { maxTicks: MAX_RUN_TICKS });
const claimed = { score, level, ticks, hash };

step(`game ${version}, the idle run plays to ${JSON.stringify(claimed)}`);
await waitForFunction();
step('the function answers a preflight request');

const unsigned = await submit(null, { replay, claimed, speed: 1 });
assert.equal(unsigned.status, 401, 'a run without a token');
step('a run without a token is refused with 401');

const { token, userId } = await signInAnonymously();
step('an anonymous player signed in');

const honest = await submit(token, { replay, claimed, speed: 1 });
assert.equal(honest.status, 201, `the honest run: ${await honest.clone().text()}`);
const stored = (await honest.json()) as { id: string };
assert.deepEqual(await rows('runs', `id=eq.${stored.id}&select=user_id,game_version,score`), [
  { user_id: userId, game_version: version, score },
]);
step('the honest run is stored for the player, with the version of this commit');

const forged = { ...claimed, score: claimed.score + 1000 };
const cheat = await submit(token, { replay, claimed: forged, speed: 1 });
assert.equal(cheat.status, 422, 'the forged run');
assert.equal(((await cheat.json()) as { reason: string }).reason, 'mismatch');
assert.deepEqual(await rows('suspicious_runs', `user_id=eq.${userId}&select=claimed`), [
  { claimed: forged },
]);
step('the forged run is refused with 422 and logged as suspicious');

const stale = await submit(token, {
  replay: { ...replay, gameVersion: '0.0.0+000000000000' },
  claimed,
  speed: 1,
});
assert.equal(stale.status, 409, 'a run of another build');
step('a run of another build is refused with 409');

// Fill the player's hour, which holds the honest run, up to the limit; one run more is too much.
const fillers = Math.floor((HOUR_LIMIT - ticks) / MAX_RUN_TICKS);
await storeRuns(
  Array.from({ length: fillers + 1 }, (_, index) => ({
    user_id: userId,
    mode: 'classic',
    difficulty: 'normal',
    hero_id: 'male',
    time_of_day: 'day',
    speed: 100,
    game_version: version,
    seed: 1,
    score: 0,
    level: 1,
    ticks: index < fillers ? MAX_RUN_TICKS : HOUR_LIMIT - ticks - fillers * MAX_RUN_TICKS,
    status: 'lost',
    state_hash: hash,
    // One zero byte, in PostgREST's hex form for a bytea: these runs are never played.
    replay: String.raw`\x00`,
  })),
);
const tooMany = await submit(token, { replay, claimed, speed: 1 });
assert.equal(tooMany.status, 429, `a run past an hour of play: ${await tooMany.clone().text()}`);
assert.equal(((await tooMany.json()) as { reason: string }).reason, 'too-many-runs');
// The wait ends when the first honest run, stored a moment ago, leaves the hour.
const retryAfter = Number(tooMany.headers.get('retry-after'));
assert.ok(retryAfter > 3000 && retryAfter <= 3600, `Retry-After: ${String(retryAfter)}`);
step(`a run past an hour of play is refused with 429, to retry in ${String(retryAfter)} s`);

process.stdout.write('The submit-run function works end to end.\n');
