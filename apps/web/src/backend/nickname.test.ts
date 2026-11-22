// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkNickname, NICKNAME_LENGTH, NICKNAME_PATTERN } from './nickname';

// By code point: the characters themselves would hide in the source.
const COMBINING_ACUTE = String.fromCodePoint(0x301);
const RIGHT_TO_LEFT_OVERRIDE = String.fromCodePoint(0x202e);
const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b);

const MIGRATIONS = join(import.meta.dirname, '../../../../supabase/migrations');

describe('checkNickname', () => {
  it.each(['Bo', 'Ada L.', 'ёжик_42', 'Café-Ångström', 'Қайрат', 'ABCDEFGHIJKLMNOPQRST'])(
    'accepts %s',
    (nickname) => {
      expect(checkNickname(nickname)).toEqual({ ok: true, nickname });
    },
  );

  it('trims the spaces around a name and joins the ones inside, as a player means them', () => {
    expect(checkNickname('  Ada \t  L.  ')).toEqual({ ok: true, nickname: 'Ada L.' });
  });

  it('composes a letter typed as a base and an accent, as the database stores it', () => {
    expect(checkNickname(`Cafe${COMBINING_ACUTE}`)).toEqual({ ok: true, nickname: 'Café' });
  });

  it.each([
    ['', 'too-short'],
    ['   ', 'too-short'],
    ['B', 'too-short'],
    ['ABCDEFGHIJKLMNOPQRSTU', 'too-long'],
    ['<b>Ada</b>', 'characters'],
    [`Ada${RIGHT_TO_LEFT_OVERRIDE}gol`, 'characters'],
    [`Ad${ZERO_WIDTH_SPACE}a`, 'characters'],
    ['Ada🐝', 'characters'],
    ['日本', 'characters'],
  ])('refuses %j as %s', (nickname, problem) => {
    expect(checkNickname(nickname)).toEqual({ ok: false, problem });
  });
});

describe('the rules of a nickname', () => {
  it('are the ones the database checks, so the server refuses what the client would', () => {
    const migration = readdirSync(MIGRATIONS)
      .filter((file) => file.endsWith('.sql'))
      .toSorted()
      .map((file) => readFileSync(join(MIGRATIONS, file), 'utf8'))
      .findLast((sql) => sql.includes('profiles_nickname_is_valid'));

    expect(migration).toContain(
      `char_length(nickname) between ${String(NICKNAME_LENGTH.min)} and ${String(NICKNAME_LENGTH.max)}`,
    );
    expect(migration).toContain(`nickname ~ '${NICKNAME_PATTERN}'`);
  });
});
