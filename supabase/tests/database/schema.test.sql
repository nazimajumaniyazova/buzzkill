-- The schema of stage 8 (#215): the tables, their types and the rules a stored row obeys, whoever
-- writes it. Who may read and write is the policies' concern (#216).
begin;

create extension if not exists pgtap with schema extensions;

select plan(36);

-- The tables and their columns.
select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'runs', 'runs exists');
select has_table('public', 'achievements', 'achievements exists');

select columns_are('public', 'profiles', array['id', 'nickname', 'created_at'], 'profiles has its columns');
select columns_are(
  'public',
  'runs',
  array[
    'id', 'user_id', 'mode', 'daily_date', 'difficulty', 'hero_id', 'time_of_day', 'speed',
    'game_version', 'seed', 'score', 'level', 'ticks', 'status', 'state_hash', 'replay',
    'verified_at', 'created_at'
  ],
  'runs has its columns'
);
select columns_are(
  'public',
  'achievements',
  array['user_id', 'achievement_id', 'unlocked_at'],
  'achievements has its columns'
);

-- The values the game knows. A new hero or difficulty is a new label here too.
select enum_has_labels('public', 'run_mode', array['classic', 'daily'], 'a run is classic or daily');
select enum_has_labels('public', 'difficulty', array['easy', 'normal', 'hard'], 'the difficulties');
select enum_has_labels('public', 'hero_id', array['male', 'female', 'sam', 'leo'], 'the heroes');
select enum_has_labels('public', 'time_of_day', array['day', 'night'], 'the times of day');
select enum_has_labels('public', 'run_status', array['won', 'lost'], 'a stored run is over');

select col_type_is('public', 'runs', 'replay', 'bytea', 'the replay is stored compressed');
select col_type_is('public', 'runs', 'seed', 'bigint', 'a seed is a 32-bit unsigned integer');

-- Row Level Security is on from the start: until #216 adds policies, no client reads or writes.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has Row Level Security'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.runs'::regclass),
  'runs has Row Level Security'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.achievements'::regclass),
  'achievements has Row Level Security'
);

-- The boards (#220): the top of each difficulty, the top of each day, and a player's own runs.
select has_index('public', 'runs', 'runs_classic_board', 'an index serves the boards by difficulty');
select has_index('public', 'runs', 'runs_daily_board', 'an index serves the board of each day');
select has_index('public', 'runs', 'runs_by_player', 'an index serves the personal records');

-- What a row must obey. `pg_temp.run` stores a valid run with one value changed.
insert into auth.users (id) values ('00000000-0000-4000-8000-000000000001');

create function pg_temp.run(
  mode text default 'classic',
  daily_date date default null,
  difficulty text default 'normal',
  time_of_day text default 'day',
  hero text default 'male',
  speed integer default 100,
  seed bigint default 2026,
  score integer default 189,
  level integer default 3,
  state_hash text default '0a1b2c3d',
  replay bytea default '\x1f8b0800'::bytea
) returns void
language sql
as $$
  insert into public.runs (
    user_id, mode, daily_date, difficulty, hero_id, time_of_day, speed, game_version, seed, score,
    level, ticks, status, state_hash, replay
  ) values (
    '00000000-0000-4000-8000-000000000001', mode::public.run_mode, daily_date,
    difficulty::public.difficulty, hero::public.hero_id, time_of_day::public.time_of_day, speed,
    '0.34.0', seed, score, level, 6564, 'lost', state_hash, replay
  );
$$;

select lives_ok($$select pg_temp.run()$$, 'a classic run is stored');
select lives_ok(
  $$select pg_temp.run(mode => 'daily', daily_date => '2026-11-20')$$,
  'a daily run is stored with its date'
);
select throws_ok($$select pg_temp.run(mode => 'daily')$$, '23514', null, 'a daily run needs its date');
select throws_ok(
  $$select pg_temp.run(daily_date => '2026-11-20')$$,
  '23514',
  null,
  'a classic run has no date'
);
select throws_ok(
  $$select pg_temp.run(mode => 'daily', daily_date => '2026-11-20', difficulty => 'hard')$$,
  '23514',
  null,
  'a daily run is played at the normal difficulty'
);
select throws_ok(
  $$select pg_temp.run(mode => 'daily', daily_date => '2026-11-20', time_of_day => 'night')$$,
  '23514',
  null,
  'a daily run is played by day'
);
select throws_ok($$select pg_temp.run(speed => 60)$$, '23514', null, 'the speed is 50, 75 or 100 %');
select throws_ok($$select pg_temp.run(seed => -1)$$, '23514', null, 'a seed is not negative');
select throws_ok($$select pg_temp.run(seed => 4294967296)$$, '23514', null, 'a seed fits 32 bits');
select throws_ok($$select pg_temp.run(score => -1)$$, '23514', null, 'a score is not negative');
select throws_ok($$select pg_temp.run(level => 7)$$, '23514', null, 'a campaign has six levels');
select throws_ok(
  $$select pg_temp.run(state_hash => 'XYZ')$$,
  '23514',
  null,
  'a state hash is 8 hex digits'
);
select throws_ok(
  $$select pg_temp.run(replay => convert_to(repeat('x', 65537), 'UTF8'))$$,
  '23514',
  null,
  'a compressed replay weighs at most 64 KiB'
);
select throws_ok($$select pg_temp.run(hero => 'mike')$$, '22P02', null, 'only known heroes');

select throws_ok(
  $$insert into public.profiles (id, nickname) values ('00000000-0000-4000-8000-000000000001', '')$$,
  '23514',
  null,
  'a nickname is not empty'
);

insert into public.achievements (user_id, achievement_id, unlocked_at)
values ('00000000-0000-4000-8000-000000000001', 'first-blood', '2026-11-20T10:00:00Z');
select throws_ok(
  $$insert into public.achievements (user_id, achievement_id, unlocked_at)
    values ('00000000-0000-4000-8000-000000000001', 'first-blood', now())$$,
  '23505',
  null,
  'an achievement is unlocked once per player'
);

-- Deleting an account deletes what it stored.
delete from auth.users where id = '00000000-0000-4000-8000-000000000001';
select is(
  (select count(*)::integer from public.runs) + (select count(*)::integer from public.achievements),
  0,
  'a deleted account leaves no runs and no achievements'
);

select * from finish();
rollback;
