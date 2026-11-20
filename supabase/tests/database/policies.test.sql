-- Who may read and write (#216): anyone reads the boards, a player writes only their own profile
-- and achievements, and only the server's function, with the service role, stores a run.
-- An anonymous account of Supabase Auth has the `authenticated` role, like a linked one.
begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

-- The policies, by name: a new one has to be added here on purpose.
select policies_are('public', 'runs', array['anyone reads the runs'], 'runs has one policy');
select policies_are(
  'public',
  'profiles',
  array['anyone reads the profiles', 'a player creates their profile', 'a player renames their profile'],
  'profiles has its policies'
);
select policies_are(
  'public',
  'achievements',
  array['anyone reads the achievements', 'a player records their achievements'],
  'achievements has its policies'
);

-- Two players, A and B, with a run, a profile and an achievement of A, stored as the owner.
insert into auth.users (id) values
  ('00000000-0000-4000-8000-00000000000a'),
  ('00000000-0000-4000-8000-00000000000b');
insert into public.profiles (id, nickname) values ('00000000-0000-4000-8000-00000000000a', 'Ada');
insert into public.achievements (user_id, achievement_id, unlocked_at)
values ('00000000-0000-4000-8000-00000000000a', 'first-blood', '2026-11-20T10:00:00Z');

-- The service role, which the function of #218 uses, stores a valid run of A. The same insert
-- fails for every other role below.
set local role service_role;
select lives_ok(
  $$insert into public.runs (
      user_id, mode, difficulty, hero_id, time_of_day, speed, game_version, seed, score, level,
      ticks, status, state_hash, replay
    ) values (
      '00000000-0000-4000-8000-00000000000a', 'classic', 'normal', 'male', 'day', 100, '0.35.0',
      2026, 189, 3, 6564, 'lost', '0a1b2c3d', '\x1f8b0800'::bytea
    )$$,
  'the service role stores a run'
);
reset role;

-- A visitor who has not signed in reads everything public and writes nothing.
set local role anon;
select is((select count(*)::integer from public.runs), 1, 'a visitor reads the runs');
select is((select count(*)::integer from public.profiles), 1, 'a visitor reads the profiles');
select is((select count(*)::integer from public.achievements), 1, 'a visitor reads the achievements');
select throws_ok(
  $$insert into public.runs (
      user_id, mode, difficulty, hero_id, time_of_day, speed, game_version, seed, score, level,
      ticks, status, state_hash, replay
    ) values (
      '00000000-0000-4000-8000-00000000000a', 'classic', 'normal', 'male', 'day', 100, '0.35.0',
      2026, 189, 3, 6564, 'lost', '0a1b2c3d', '\x1f8b0800'::bytea
    )$$,
  '42501',
  null,
  'a visitor cannot store a run'
);
select throws_ok(
  $$insert into public.profiles (id, nickname) values ('00000000-0000-4000-8000-00000000000b', 'Bo')$$,
  '42501',
  null,
  'a visitor cannot create a profile'
);
select throws_ok(
  $$update public.profiles set nickname = 'Eve'$$,
  '42501',
  null,
  'a visitor cannot rename a profile'
);
select throws_ok(
  $$insert into public.achievements (user_id, achievement_id, unlocked_at)
    values ('00000000-0000-4000-8000-00000000000a', 'boss-slayer', now())$$,
  '42501',
  null,
  'a visitor cannot record an achievement'
);
reset role;

-- Player A, signed in.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}',
  true
);

select is((select count(*)::integer from public.runs), 1, 'a player reads the runs');
select throws_ok(
  $$insert into public.runs (
      user_id, mode, difficulty, hero_id, time_of_day, speed, game_version, seed, score, level,
      ticks, status, state_hash, replay
    ) values (
      '00000000-0000-4000-8000-00000000000a', 'classic', 'normal', 'male', 'day', 100, '0.35.0',
      2026, 189, 3, 6564, 'lost', '0a1b2c3d', '\x1f8b0800'::bytea
    )$$,
  '42501',
  null,
  'a player cannot store a run, not even their own'
);
select throws_ok(
  $$update public.runs set score = 100000$$,
  '42501',
  null,
  'a player cannot change a run'
);
select throws_ok($$delete from public.runs$$, '42501', null, 'a player cannot delete a run');

select lives_ok(
  $$update public.profiles set nickname = 'Ada L.' where id = '00000000-0000-4000-8000-00000000000a'$$,
  'a player renames their profile'
);
select throws_ok(
  $$insert into public.profiles (id, nickname) values ('00000000-0000-4000-8000-00000000000b', 'Bo')$$,
  '42501',
  null,
  'a player cannot create the profile of another'
);
select throws_ok(
  $$update public.profiles set id = '00000000-0000-4000-8000-00000000000b'
    where id = '00000000-0000-4000-8000-00000000000a'$$,
  '42501',
  null,
  'a player cannot hand their profile to another'
);
select throws_ok(
  $$delete from public.profiles$$,
  '42501',
  null,
  'a player cannot delete a profile; deleting the account does'
);

select lives_ok(
  $$insert into public.achievements (user_id, achievement_id, unlocked_at)
    values ('00000000-0000-4000-8000-00000000000a', 'boss-slayer', '2026-11-20T11:00:00Z')$$,
  'a player records their achievement'
);
select throws_ok(
  $$insert into public.achievements (user_id, achievement_id, unlocked_at)
    values ('00000000-0000-4000-8000-00000000000b', 'boss-slayer', now())$$,
  '42501',
  null,
  'a player cannot record an achievement of another'
);
select throws_ok(
  $$update public.achievements set unlocked_at = now()$$,
  '42501',
  null,
  'a player cannot change an achievement once recorded'
);
select throws_ok(
  $$delete from public.achievements$$,
  '42501',
  null,
  'a player cannot delete an achievement'
);
reset role;

-- Player B, signed in: A's profile is not theirs to rename. An update that a policy filters out
-- changes no row instead of failing, so the name is read back as the owner.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000b", "role": "authenticated"}',
  true
);
update public.profiles set nickname = 'Eve' where id = '00000000-0000-4000-8000-00000000000a';
select lives_ok(
  $$insert into public.profiles (id, nickname) values ('00000000-0000-4000-8000-00000000000b', 'Bo')$$,
  'a player creates their own profile'
);
reset role;

select is(
  (select nickname from public.profiles where id = '00000000-0000-4000-8000-00000000000a'),
  'Ada L.',
  'a player cannot rename the profile of another'
);
select is(
  (select count(*)::integer from public.runs),
  1,
  'only the service role stored a run'
);
select is(
  (select count(*)::integer from public.achievements),
  2,
  'only the players stored their own achievements'
);

select * from finish();
rollback;
