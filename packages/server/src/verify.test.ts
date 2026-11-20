import { dailySeed, parseReplay, simulate } from '@buzzkill/game';
import { describe, expect, it } from 'vitest';

import { MAX_RUN_TICKS, MAX_SUBMISSION_BYTES, verifySubmission } from './verify';

const GAME_VERSION = '0.35.0';
const TODAY = '2026-11-20';
const CONTEXT = { gameVersion: GAME_VERSION, today: TODAY };

/**
 * A replay in which the hero never moves or fires. The run is lost after 1526 ticks, short
 * enough to play in a test, and its result below was found by `simulate`.
 */
const IDLE = {
  formatVersion: 3,
  gameVersion: GAME_VERSION,
  seed: 2026,
  heroId: 'male',
  mode: 'day',
  difficulty: 'normal',
  daily: null,
  inputs: [],
};
const IDLE_RESULT = { score: 0, level: 1, ticks: 1526, hash: '105607ed' };

/** The daily run of `date`, played the same idle way. */
function idleDaily(date: string) {
  return { ...IDLE, daily: date, seed: dailySeed(date) };
}
const DAILY_RESULT = { score: 0, level: 1, ticks: 1528, hash: 'a25e652e' };

/** What the game finds when it plays `replay`, as an honest client would claim it. */
function resultOf(replay: object) {
  const parsed = parseReplay(replay);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const { score, level, ticks, hash } = simulate(parsed.replay, { maxTicks: MAX_RUN_TICKS });
  return { score, level, ticks, hash };
}

function body(replay: object, claimed: object = IDLE_RESULT, speed = 1): string {
  return JSON.stringify({ replay, claimed, speed });
}

describe('verifySubmission', () => {
  it('accepts a run whose replay plays to the claimed result, and describes it for storing', () => {
    const verdict = verifySubmission(body(IDLE), CONTEXT);

    expect(verdict).toEqual({
      ok: true,
      run: {
        mode: 'classic',
        dailyDate: null,
        difficulty: 'normal',
        heroId: 'male',
        timeOfDay: 'day',
        speed: 100,
        gameVersion: GAME_VERSION,
        seed: 2026,
        score: 0,
        level: 1,
        ticks: 1526,
        status: 'lost',
        stateHash: '105607ed',
        replay: JSON.stringify(IDLE),
      },
    });
  });

  it('keeps the speed the run was played at, in percent (ADR-0014)', () => {
    const verdict = verifySubmission(body(IDLE, IDLE_RESULT, 0.5), CONTEXT);

    expect(verdict.ok && verdict.run.speed).toBe(50);
  });

  it('accepts a daily run of today, and one of yesterday that ended after midnight UTC', () => {
    const yesterday = idleDaily('2026-11-19');

    expect(verifySubmission(body(idleDaily(TODAY), DAILY_RESULT), CONTEXT)).toMatchObject({
      ok: true,
      run: { mode: 'daily', dailyDate: TODAY },
    });
    expect(verifySubmission(body(yesterday, resultOf(yesterday)), CONTEXT)).toMatchObject({
      ok: true,
      run: { mode: 'daily', dailyDate: '2026-11-19' },
    });
  });

  it('refuses a daily run of another day', () => {
    expect(verifySubmission(body(idleDaily('2026-11-18'), DAILY_RESULT), CONTEXT)).toMatchObject({
      ok: false,
      status: 422,
      reason: 'not-today',
      suspicious: false,
    });
    expect(verifySubmission(body(idleDaily('2026-11-21'), DAILY_RESULT), CONTEXT)).toMatchObject({
      ok: false,
      status: 422,
      reason: 'not-today',
    });
  });

  it('refuses a request over its size before reading it', () => {
    const large = body({ ...IDLE, padding: 'x'.repeat(MAX_SUBMISSION_BYTES) });

    expect(verifySubmission(large, CONTEXT)).toMatchObject({
      ok: false,
      status: 413,
      reason: 'too-large',
    });
  });

  it('counts the size in bytes, not characters', () => {
    // Each "é" is two bytes in UTF-8: the text is short in characters and over the limit in bytes.
    const wide = 'é'.repeat(MAX_SUBMISSION_BYTES / 2 + 1);

    expect(verifySubmission(wide, CONTEXT)).toMatchObject({ status: 413 });
  });

  it('refuses a request that is not JSON, or not a submission', () => {
    expect(verifySubmission('{"replay":', CONTEXT)).toMatchObject({
      ok: false,
      status: 400,
      reason: 'invalid',
    });
    expect(verifySubmission(body(IDLE, IDLE_RESULT, 0.6), CONTEXT)).toMatchObject({
      status: 400,
      reason: 'invalid',
    });
    expect(verifySubmission(JSON.stringify({ replay: IDLE, speed: 1 }), CONTEXT)).toMatchObject({
      status: 400,
      reason: 'invalid',
    });
  });

  it('refuses a replay the game cannot read, with the reason', () => {
    const wrongSeed = { ...idleDaily(TODAY), seed: 1 };
    const verdict = verifySubmission(body(wrongSeed, DAILY_RESULT), CONTEXT);

    expect(verdict).toMatchObject({ ok: false, status: 400, reason: 'invalid' });
    expect(!verdict.ok && verdict.detail).toContain('seed of a daily run');
  });

  it('asks the client to reload when the replay comes from another version of the game', () => {
    const verdict = verifySubmission(body({ ...IDLE, gameVersion: '0.34.0' }), CONTEXT);

    expect(verdict).toMatchObject({
      ok: false,
      status: 409,
      reason: 'stale-version',
      suspicious: false,
    });
    expect(!verdict.ok && verdict.detail).toContain(GAME_VERSION);
  });

  it('refuses a run whose replay plays to another score, and marks it suspicious', () => {
    const claimed = { ...IDLE_RESULT, score: 5000 };
    const verdict = verifySubmission(body(IDLE, claimed), CONTEXT);

    expect(verdict).toMatchObject({
      ok: false,
      status: 422,
      reason: 'mismatch',
      suspicious: true,
      claimed,
      found: IDLE_RESULT,
      gameVersion: GAME_VERSION,
      seed: 2026,
    });
  });

  it('keeps the replay of a suspicious run as canonical JSON, for the log', () => {
    const verdict = verifySubmission(body(IDLE, { ...IDLE_RESULT, score: 5000 }), CONTEXT);

    expect(!verdict.ok && verdict.reason === 'mismatch' && JSON.parse(verdict.replay)).toEqual(
      IDLE,
    );
  });

  it('refuses a run whose state hash differs, even with the same score', () => {
    expect(
      verifySubmission(body(IDLE, { ...IDLE_RESULT, hash: '00000000' }), CONTEXT),
    ).toMatchObject({ status: 422, reason: 'mismatch', suspicious: true });
  });

  it('refuses a run that is not over by the tick limit', () => {
    expect(verifySubmission(body(IDLE), { ...CONTEXT, maxTicks: 1000 })).toMatchObject({
      ok: false,
      status: 422,
      reason: 'unfinished',
      suspicious: false,
    });
  });

  it('plays at most 15 minutes of a run by default, within the CPU of an Edge Function', () => {
    expect(MAX_RUN_TICKS).toBe(15 * 60 * 60);
  });

  it('stays within its byte limit for a whole campaign', () => {
    expect(MAX_SUBMISSION_BYTES).toBe(128 * 1024);
  });
});
