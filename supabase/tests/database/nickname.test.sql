-- What a nickname may be (#217). The boards show it to everyone, so the database refuses what the
-- client should never have sent: the same rules as `apps/web/src/backend/nickname.ts`.
begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (id) values ('00000000-0000-4000-8000-00000000000a');

-- Stores `nickname` as the profile of the test player, then removes it again.
create function pg_temp.profile_named(nickname text)
returns void
language sql
as $$
  insert into public.profiles (id, nickname)
  values ('00000000-0000-4000-8000-00000000000a', nickname);
  delete from public.profiles where id = '00000000-0000-4000-8000-00000000000a';
$$;

select lives_ok($$select pg_temp.profile_named('Bo')$$, 'two characters are enough');
select lives_ok(
  $$select pg_temp.profile_named('Ada L.')$$,
  'a space between words, and a dot'
);
select lives_ok(
  $$select pg_temp.profile_named('ёжик_42')$$,
  'Cyrillic, digits and an underscore'
);
select lives_ok(
  $$select pg_temp.profile_named('Café-Ångström')$$,
  'Latin letters with diacritics, and a hyphen'
);
select lives_ok(
  $$select pg_temp.profile_named('ABCDEFGHIJKLMNOPQRST')$$,
  'twenty characters'
);

select throws_ok(
  $$select pg_temp.profile_named('B')$$,
  '23514',
  null,
  'one character is too short'
);
select throws_ok(
  $$select pg_temp.profile_named('ABCDEFGHIJKLMNOPQRSTU')$$,
  '23514',
  null,
  'twenty-one are too long'
);
select throws_ok($$select pg_temp.profile_named(' Ada')$$, '23514', null, 'no space before');
select throws_ok($$select pg_temp.profile_named('Ada ')$$, '23514', null, 'no space after');
select throws_ok(
  $$select pg_temp.profile_named('Ada  L')$$,
  '23514',
  null,
  'no two spaces in a row'
);
select throws_ok($$select pg_temp.profile_named('<b>Ada</b>')$$, '23514', null, 'no markup');
select throws_ok(
  $$select pg_temp.profile_named(U&'Ada\202Egol')$$,
  '23514',
  null,
  'no right-to-left override, which would show the rest of the name reversed'
);
select throws_ok(
  $$select pg_temp.profile_named(U&'Ad\200Ba')$$,
  '23514',
  null,
  'no invisible character'
);
select throws_ok(
  $$select pg_temp.profile_named(U&'Ada\+01F41D')$$,
  '23514',
  null,
  'no emoji'
);
select throws_ok(
  $$select pg_temp.profile_named('日本')$$,
  '23514',
  null,
  'no other script yet'
);

select * from finish();
rollback;
