-- The boards (#220): `best_runs` holds each player's best run of each board, at 100 % only
-- (ADR-0014), with the nickname, and without the replay. A board is its rows of one mode, one
-- difficulty and, for the daily challenge, one day, by score, the earlier run first on a tie.
begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

select has_view('public', 'best_runs', 'the boards read a view');
select ok(
  (select 'security_invoker=true' = any(reloptions) from pg_class where oid = 'public.best_runs'::regclass),
  'it reads the tables with the rights of who asks, so their policies hold'
);
select hasnt_column('public', 'best_runs', 'replay', 'it leaves the replay out');
select hasnt_column('public', 'best_runs', 'speed', 'every row is at 100 %, so the speed is not there');
select ok(
  has_table_privilege('anon', 'public.best_runs', 'select'),
  'a visitor who has not signed in reads it'
);
select ok(
  not has_table_privilege('authenticated', 'public.best_runs', 'insert')
    and not has_table_privilege('authenticated', 'public.best_runs', 'update')
    and not has_table_privilege('authenticated', 'public.best_runs', 'delete'),
  'nobody writes through it'
);

-- Ann and Bob have profiles; the third player has none yet.
insert into auth.users (id) values
  ('00000000-0000-4000-8000-00000000000a'),
  ('00000000-0000-4000-8000-00000000000b'),
  ('00000000-0000-4000-8000-00000000000c');
insert into public.profiles (id, nickname) values
  ('00000000-0000-4000-8000-00000000000a', 'Ann'),
  ('00000000-0000-4000-8000-00000000000b', 'Bob');

create function pg_temp.run(
  player uuid,
  run_mode public.run_mode,
  run_day date,
  run_difficulty public.difficulty,
  run_speed smallint,
  run_score integer,
  ago interval
)
returns void
language sql
as $$
  insert into public.runs (
    user_id, mode, daily_date, difficulty, hero_id, time_of_day, speed, game_version, seed,
    score, level, ticks, status, state_hash, replay, created_at
  )
  values (
    player, run_mode, run_day, run_difficulty, 'male', 'day', run_speed, '0.41.0', 1,
    run_score, 1, 600, 'lost', '105607ed', '\x00'::bytea, now() - ago
  )
$$;

select pg_temp.run('00000000-0000-4000-8000-00000000000a', 'classic', null, 'normal', 100::smallint, 500, '5 days');
select pg_temp.run('00000000-0000-4000-8000-00000000000a', 'classic', null, 'normal', 100::smallint, 900, '1 day');
select pg_temp.run('00000000-0000-4000-8000-00000000000a', 'classic', null, 'normal', 75::smallint, 2000, '1 hour');
select pg_temp.run('00000000-0000-4000-8000-00000000000a', 'classic', null, 'hard', 100::smallint, 300, '2 days');
select pg_temp.run('00000000-0000-4000-8000-00000000000b', 'classic', null, 'normal', 100::smallint, 900, '3 days');
select pg_temp.run('00000000-0000-4000-8000-00000000000c', 'classic', null, 'normal', 100::smallint, 100, '4 days');
select pg_temp.run('00000000-0000-4000-8000-00000000000a', 'daily', '2026-11-20', 'normal', 100::smallint, 400, '4 days');
select pg_temp.run('00000000-0000-4000-8000-00000000000b', 'daily', '2026-11-20', 'normal', 100::smallint, 700, '4 days');
select pg_temp.run('00000000-0000-4000-8000-00000000000b', 'daily', '2026-11-20', 'normal', 100::smallint, 600, '4 days');
select pg_temp.run('00000000-0000-4000-8000-00000000000b', 'daily', '2026-11-21', 'normal', 50::smallint, 9000, '3 days');

-- A visitor who has not signed in reads the boards.
set local role anon;

select results_eq(
  $$select nickname, score from public.best_runs
    where mode = 'classic' and difficulty = 'normal'
    order by score desc, created_at$$,
  $$values ('Bob'::text, 900), ('Ann', 900), (null, 100)$$,
  'a board has each player once, with their best run at 100 %, the earlier first on a tie'
);
select results_eq(
  $$select nickname, score from public.best_runs
    where mode = 'classic' and difficulty = 'hard'$$,
  $$values ('Ann'::text, 300)$$,
  'each difficulty is a board of its own'
);
select results_eq(
  $$select nickname, score from public.best_runs
    where mode = 'daily' and daily_date = '2026-11-20'
    order by score desc, created_at$$,
  $$values ('Bob'::text, 700), ('Ann', 400)$$,
  'a day is a board of its own, with each player once'
);
select is_empty(
  $$select 1 from public.best_runs where mode = 'daily' and daily_date = '2026-11-21'$$,
  'a slower run is no one''s place on a board'
);
select is(
  (select id from public.best_runs where mode = 'classic' and difficulty = 'normal' and nickname = 'Ann'),
  (select id from public.runs where score = 900 and user_id = '00000000-0000-4000-8000-00000000000a'),
  'a row is the id of its run, for its replay (#219)'
);
select ok(
  (select count(*) = 3 from public.best_runs where mode = 'classic' and difficulty = 'normal'),
  'the third player is on the board without a nickname'
);

select * from finish();
rollback;
