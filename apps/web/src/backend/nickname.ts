/** How long a nickname may be, in characters (code points), as `char_length` counts them. */
export const NICKNAME_LENGTH = { min: 2, max: 20 } as const;

/**
 * Words of Latin letters (with the diacritics of Latin-1 and Latin Extended-A), Cyrillic letters,
 * digits, `.`, `_` and `-`, one space between them. The ranges are code points, which JavaScript
 * and Postgres read alike; letter classes such as `[[:alpha:]]` depend on the database's locale.
 * What it leaves out is what makes a name lie on a board: control and invisible characters,
 * direction overrides, markup and emoji. The Cyrillic range skips its combining marks.
 *
 * The `profiles_nickname_is_valid` check of `supabase/migrations` holds the same pattern, and a
 * test compares them.
 */
export const NICKNAME_PATTERN =
  '^[0-9A-Za-zÀ-ÖØ-öø-ÿĀ-žЀ-ҁҊ-ӿ._-]+( [0-9A-Za-zÀ-ÖØ-öø-ÿĀ-žЀ-ҁҊ-ӿ._-]+)*$';

const NICKNAME = new RegExp(NICKNAME_PATTERN, 'u');

type NicknameProblem = 'too-short' | 'too-long' | 'characters';

export type NicknameCheck =
  | { readonly ok: true; readonly nickname: string }
  | { readonly ok: false; readonly problem: NicknameProblem };

/**
 * A nickname as the player typed it, made into the one the database accepts or the reason it
 * cannot be. Spaces around it go and runs of them inside become one, and accents typed as
 * separate marks are composed (NFC), since the database checks without changing anything.
 */
export function checkNickname(typed: string): NicknameCheck {
  const nickname = typed.normalize('NFC').trim().replace(/\s+/gu, ' ');
  // Code points, not graphemes: the database's `char_length` counts them.
  const length = Array.from(nickname).length;
  if (length < NICKNAME_LENGTH.min) {
    return { ok: false, problem: 'too-short' };
  }
  if (length > NICKNAME_LENGTH.max) {
    return { ok: false, problem: 'too-long' };
  }
  if (!NICKNAME.test(nickname)) {
    return { ok: false, problem: 'characters' };
  }
  return { ok: true, nickname };
}
