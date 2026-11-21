-- What a nickname may be (#217). The boards show every player's name to everyone, so the database
-- checks it again whatever the client sent: 2 to 20 characters, words of Latin letters (with the
-- diacritics of Latin-1 and Latin Extended-A), Cyrillic letters without its combining marks,
-- digits, `.`, `_` and `-`, one space between them. Control and invisible characters, direction
-- overrides, markup and emoji are left out. The ranges are code points, which Postgres and
-- JavaScript read alike; `checkNickname` in `apps/web/src/backend/nickname.ts` holds the same
-- pattern, and a test compares them.
alter table public.profiles
  drop constraint profiles_nickname_check,
  add constraint profiles_nickname_is_valid check (
    char_length(nickname) between 2 and 20
    and nickname ~ '^[0-9A-Za-zÀ-ÖØ-öø-ÿĀ-žЀ-ҁҊ-ӿ._-]+( [0-9A-Za-zÀ-ÖØ-öø-ÿĀ-žЀ-ҁҊ-ӿ._-]+)*$'
  );
