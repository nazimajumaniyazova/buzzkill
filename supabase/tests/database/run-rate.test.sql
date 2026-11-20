-- How fast a player may submit runs (#235): no more play in an hour than an hour holds, and the
-- run that began before it. A run cannot be played faster than real time, so honest play never
-- reaches the limit, while a script that sends idle replays does.
begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

select has_trigger(
  'public', 'runs', 'limit_run_ticks', 'a trigger limits the play a player stores'
);
select has_index(
  'public',
  'runs',
  'runs_by_player_recent',
  'an index serves the sum of a player''s last hour'
);
select is(
  has_function_privilege('anon', 'public.limit_run_ticks()', 'execute'),
  false,
  'a visitor cannot call the trigger''s function'
);
select is(
  has_function_privilege('authenticated', 'public.limit_run_ticks()', 'execute'),
  false,
  'a player cannot call the trigger''s function'
);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-00000000000a'),
  ('00000000-0000-4000-8000-00000000000b');

-- A lost classic run of `ticks`, stored `ago` before now. `now()` is the start of this
-- transaction, so the times below are exact.
create function pg_temp.run(player uuid, ticks integer, ago interval default '0')
returns void
language sql
as $$
  insert into public.runs (
    user_id, mode, difficulty, hero_id, time_of_day, speed, game_version, seed, score, level,
    ticks, status, state_hash, replay, created_at
  )
  values (
    player, 'classic', 'normal', 'male', 'day', 100, '0.37.0', 1, 0, 1,
    ticks, 'lost', '105607ed', '\x00'::bytea, now() - ago
  )
$$;

-- The hint of the error `statement` raises, or null when it raises none.
create function pg_temp.hint_of(statement text)
returns text
language plpgsql
as $$
declare
  hint text;
begin
  execute statement;
  return null;
exception when others then
  get stacked diagnostics hint = pg_exception_hint;
  return hint;
end;
$$;

-- A player who played all hour in runs of the longest kind, 15 minutes or 54,000 ticks each:
-- the first was stored 59 minutes ago and began a quarter of an hour before that. One insert
-- stores four of them, and the trigger counts the rows stored before each in the same command.
insert into public.runs (
  user_id, mode, difficulty, hero_id, time_of_day, speed, game_version, seed, score, level,
  ticks, status, state_hash, replay, created_at
)
select
  '00000000-0000-4000-8000-00000000000a', 'classic', 'normal', 'male', 'day', 100, '0.37.0', 1,
  0, 1, 54000, 'lost', '105607ed', '\x00'::bytea, now() - ago
from unnest(array[
  interval '59 minutes', interval '45 minutes', interval '30 minutes', interval '15 minutes'
]) as ago;
select lives_ok(
  $$select pg_temp.run('00000000-0000-4000-8000-00000000000a', 54000)$$,
  'an hour of play, and the run that began before it, are stored'
);

select throws_ok(
  $$select pg_temp.run('00000000-0000-4000-8000-00000000000a', 1)$$,
  'PT429',
  'a player cannot submit more play than an hour holds',
  'one tick more is refused with the state PostgREST answers as 429'
);
select is(
  pg_temp.hint_of($$select pg_temp.run('00000000-0000-4000-8000-00000000000a', 1)$$),
  '60',
  'the refusal says in seconds when the hour has room: when its oldest run leaves it'
);
select is(
  (select count(*)::integer from public.runs
    where user_id = '00000000-0000-4000-8000-00000000000a'),
  5,
  'a refused run is not stored'
);

select lives_ok(
  $$select pg_temp.run('00000000-0000-4000-8000-00000000000b', 54000)$$,
  'another player''s runs do not count'
);

-- An hour later the same player has room again.
update public.runs set created_at = created_at - interval '1 hour'
where user_id = '00000000-0000-4000-8000-00000000000a';
select lives_ok(
  $$select pg_temp.run('00000000-0000-4000-8000-00000000000a', 54000)$$,
  'runs older than an hour do not count'
);

select * from finish();
rollback;
