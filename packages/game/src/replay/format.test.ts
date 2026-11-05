// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import { ENEMY_SETS } from '../config/enemies';
import { HEROES } from '../config/rules';
import {
  deserializeReplay,
  MAX_REPLAY_CHANGES,
  parseReplay,
  type Replay,
  REPLAY_ACTION_MASK,
  serializeReplay,
} from './format';
import { createReplayRecorder } from './recorder';

const VALID: Replay = {
  formatVersion: 1,
  gameVersion: '0.1.0',
  seed: 0xde_ad_be_ef,
  heroId: 'female',
  mode: 'night',
  inputs: [1, 4, 30, 6, 200, 0],
};

function errorOf(value: unknown): string {
  const result = parseReplay(value);
  if (result.ok) {
    throw new Error('expected the replay to be rejected');
  }
  return result.error;
}

describe('replay format', () => {
  it('accepts a valid replay and keeps its values', () => {
    expect(parseReplay(VALID)).toEqual({ ok: true, replay: VALID });
  });

  it('knows every hero and every mode of the configuration', () => {
    for (const heroId of Object.keys(HEROES)) {
      for (const mode of Object.keys(ENEMY_SETS)) {
        expect(parseReplay({ ...VALID, heroId, mode }).ok).toBe(true);
      }
    }
  });

  it('round-trips through compact JSON with a fixed field order', () => {
    const json = serializeReplay({ ...VALID, extra: 1 } as Replay);

    expect(json).toBe(
      '{"formatVersion":1,"gameVersion":"0.1.0","seed":3735928559,"heroId":"female",' +
        '"mode":"night","inputs":[1,4,30,6,200,0]}',
    );
    expect(deserializeReplay(json)).toEqual({ ok: true, replay: VALID });
  });

  it('drops unknown fields', () => {
    const result = parseReplay({ ...VALID, cheat: true });

    expect(result.ok && 'cheat' in result.replay).toBe(false);
  });

  it.each([
    ['another format version', { formatVersion: 2 }, 'formatVersion'],
    ['an empty game version', { gameVersion: '' }, 'gameVersion'],
    ['a negative seed', { seed: -1 }, 'seed'],
    ['a seed beyond 32 bits', { seed: 2 ** 32 }, 'seed'],
    ['a fractional seed', { seed: 1.5 }, 'seed'],
    ['an unknown hero', { heroId: 'robot' }, 'heroId'],
    ['an unknown mode', { mode: 'dusk' }, 'mode'],
    ['inputs that are not numbers', { inputs: ['1', 4] }, 'inputs'],
    ['negative inputs', { inputs: [-1, 4] }, 'inputs'],
  ])('rejects %s', (_name, patch, field) => {
    expect(errorOf({ ...VALID, ...patch })).toContain(field);
  });

  it.each([
    ['an odd number of inputs', [1, 4, 3], 'pairs'],
    ['two changes in one tick', [1, 4, 0, 0], 'at least one tick'],
    ['a change at tick 0', [0, 4], 'at least one tick'],
    ['the pause action', [1, 8], 'outside the replay actions'],
    ['bits beyond the actions', [1, 16], 'outside the replay actions'],
    ['a mask that repeats the previous one', [1, 4, 5, 4], 'repeats'],
    ['a first mask with nothing down', [1, 0], 'repeats'],
  ])('rejects inputs with %s', (_name, inputs, message) => {
    expect(errorOf({ ...VALID, inputs })).toContain(message);
  });

  it('rejects more input changes than the limit', () => {
    const inputs = Array.from({ length: MAX_REPLAY_CHANGES + 1 }, (_, i) => [
      1,
      i % 2 === 0 ? 1 : 2,
    ]);

    expect(errorOf({ ...VALID, inputs: inputs.flat() })).toContain('inputs');
  });

  it('rejects data that is not a replay or not JSON', () => {
    expect(parseReplay(null).ok).toBe(false);
    expect(parseReplay([]).ok).toBe(false);
    expect(deserializeReplay('{"formatVersion":')).toEqual({
      ok: false,
      error: 'the replay is not valid JSON',
    });
  });

  test.prop([
    fc.nat({ max: 0xff_ff_ff_ff }),
    fc.array(fc.tuple(fc.integer({ min: 1, max: 600 }), fc.nat({ max: REPLAY_ACTION_MASK })), {
      maxLength: 200,
    }),
  ])('accepts everything a recorder produces, after a JSON round trip', (seed, steps) => {
    const recorder = createReplayRecorder({
      gameVersion: '0.1.0',
      seed,
      heroId: 'male',
      mode: 'day',
    });
    let tick = 0;
    for (const [gap, down] of steps) {
      tick += gap;
      recorder.recordInput(tick, down);
    }
    const replay = recorder.replay();

    expect(deserializeReplay(serializeReplay(replay))).toEqual({ ok: true, replay });
  });
});
