-- The log of suspicious attempts (#218): a replay that plays to another result than its claim.
-- Only the server's function writes it and only the owner reads it, and it keeps few rows per
-- player, so a forger cannot fill the free plan's database.
begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

select has_table('public', 'suspicious_runs', 'suspicious_runs exists');
select columns_are(
  'public',
  'suspicious_runs',
  array['id', 'user_id', 'game_version', 'seed', 'claimed', 'found', 'replay', 'created_at'],
  'suspicious_runs has its columns'
);
select col_type_is('public', 'suspicious_runs', 'claimed', 'jsonb', 'the claimed result is JSON');
select col_type_is('public', 'suspicious_runs', 'replay', 'bytea', 'the replay is stored compressed');
select is(
  (select relrowsecurity from pg_class where oid = 'public.suspicious_runs'::regclass),
  true,
  'row level security is on'
);
select policies_are('public', 'suspicious_runs', array[]::name[], 'no client has a policy');

insert into auth.users (id) values
  ('00000000-0000-4000-8000-00000000000a'),
  ('00000000-0000-4000-8000-00000000000b');

-- The service role, which the function uses, logs an attempt and reads it back.
set local role service_role;
select lives_ok(
  $$insert into public.suspicious_runs (user_id, game_version, seed, claimed, found, replay)
    values (
      '00000000-0000-4000-8000-00000000000a', '0.36.0+5c06cad63ac3', 2026,
      '{"score": 9999, "level": 6, "ticks": 1526, "hash": "105607ed"}',
      '{"score": 0, "level": 1, "ticks": 1526, "hash": "105607ed"}',
      '\x1f8b0800'::bytea
    )$$,
  'the service role logs an attempt'
);
select is((select count(*)::integer from public.suspicious_runs), 1, 'the service role reads the log');
reset role;

-- No client reads or writes the log, signed in or not.
set local role anon;
select throws_ok(
  $$select count(*) from public.suspicious_runs$$,
  '42501',
  null,
  'a visitor cannot read the log'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}',
  true
);
select throws_ok(
  $$select count(*) from public.suspicious_runs$$,
  '42501',
  null,
  'a player cannot read the log, even of their own attempts'
);
select throws_ok(
  $$insert into public.suspicious_runs (user_id, game_version, seed, claimed, found, replay)
    values ('00000000-0000-4000-8000-00000000000a', '0.36.0', 1, '{}', '{}', '\x00'::bytea)$$,
  '42501',
  null,
  'a player cannot write the log'
);
reset role;

-- What a row must hold, whoever writes it.
select throws_ok(
  $$insert into public.suspicious_runs (user_id, game_version, seed, claimed, found, replay)
    values ('00000000-0000-4000-8000-00000000000b', '0.36.0', 1, '[]', '{}', '\x00'::bytea)$$,
  '23514',
  null,
  'a claimed result is an object'
);
select throws_ok(
  $$insert into public.suspicious_runs (user_id, game_version, seed, claimed, found, replay)
    values (
      '00000000-0000-4000-8000-00000000000b', '0.36.0', 1, '{}', '{}',
      decode(repeat('00', 65537), 'hex')
    )$$,
  '23514',
  null,
  'a replay is at most 64 KiB'
);

-- At most ten attempts of a player a day are kept; more are dropped without an error, so the
-- function answers the forger as before.
insert into public.suspicious_runs (user_id, game_version, seed, claimed, found, replay)
select '00000000-0000-4000-8000-00000000000a', '0.36.0', n, '{}', '{}', '\x00'::bytea
from generate_series(2, 12) as n;
select is(
  (select count(*)::integer from public.suspicious_runs
    where user_id = '00000000-0000-4000-8000-00000000000a'),
  10,
  'a player keeps ten attempts a day'
);
select is(
  (select count(*)::integer from public.suspicious_runs
    where user_id = '00000000-0000-4000-8000-00000000000a' and seed in (11, 12)),
  0,
  'the attempts over the limit are the ones dropped'
);

insert into public.suspicious_runs (user_id, game_version, seed, claimed, found, replay)
values ('00000000-0000-4000-8000-00000000000b', '0.36.0', 1, '{}', '{}', '\x00'::bytea);
select is(
  (select count(*)::integer from public.suspicious_runs
    where user_id = '00000000-0000-4000-8000-00000000000b'),
  1,
  'another player is still logged'
);

-- Attempts older than a day do not count against the limit.
update public.suspicious_runs set created_at = now() - interval '25 hours'
where user_id = '00000000-0000-4000-8000-00000000000a';
insert into public.suspicious_runs (user_id, game_version, seed, claimed, found, replay)
values ('00000000-0000-4000-8000-00000000000a', '0.36.0', 13, '{}', '{}', '\x00'::bytea);
select is(
  (select count(*)::integer from public.suspicious_runs
    where user_id = '00000000-0000-4000-8000-00000000000a'),
  11,
  'a new day logs again'
);

select * from finish();
rollback;
