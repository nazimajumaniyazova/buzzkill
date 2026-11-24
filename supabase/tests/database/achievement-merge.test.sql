-- The merge of a device's achievements into the account's (#221): a signed-in player sends what
-- the device has unlocked and reads back the account's whole set, in which each achievement keeps
-- the earlier of its times. The table itself stays insert-only for players (#216).
begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

select has_function('public', 'merge_achievements', array['jsonb'], 'the merge is a function');
select is_definer(
  'public',
  'merge_achievements',
  array['jsonb'],
  'it runs as its owner, since players cannot update the table'
);
select ok(
  not has_function_privilege('anon', 'public.merge_achievements(jsonb)', 'execute'),
  'a visitor who has not signed in cannot call it'
);
select ok(
  has_function_privilege('authenticated', 'public.merge_achievements(jsonb)', 'execute'),
  'a signed-in player can call it'
);

-- Two players: A has two achievements in the account, B has one that A also sends.
insert into auth.users (id) values
  ('00000000-0000-4000-8000-00000000000a'),
  ('00000000-0000-4000-8000-00000000000b');
insert into public.achievements (user_id, achievement_id, unlocked_at) values
  ('00000000-0000-4000-8000-00000000000a', 'firstSwat', '2026-11-10T00:00:00Z'),
  ('00000000-0000-4000-8000-00000000000a', 'regicide', '2026-11-05T00:00:00Z'),
  ('00000000-0000-4000-8000-00000000000b', 'firstSwat', '2026-11-01T00:00:00Z');

-- Player A, signed in.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}',
  true
);

select results_eq(
  $$select achievement_id, unlocked_at from public.merge_achievements(
      '[{"achievement_id": "firstSwat", "unlocked_at": "2026-11-02T00:00:00Z"},
        {"achievement_id": "regicide", "unlocked_at": "2026-11-20T00:00:00Z"},
        {"achievement_id": "champion", "unlocked_at": "2026-11-21T00:00:00+03:00"}]'
    )$$,
  $$values
      ('champion'::text, '2026-11-20T21:00:00Z'::timestamptz),
      ('firstSwat', '2026-11-02T00:00:00Z'),
      ('regicide', '2026-11-05T00:00:00Z')$$,
  'the account gains what it lacked, each achievement keeps its earlier time, and only A''s are read'
);
select is(
  (select unlocked_at from public.merge_achievements(
    '[{"achievement_id": "flawless", "unlocked_at": "2999-01-01T00:00:00Z"}]'
  ) where achievement_id = 'flawless'),
  now(),
  'a time to come is kept as now'
);
select is(
  (select unlocked_at from public.merge_achievements(
    '[{"achievement_id": "collector", "unlocked_at": "2026-11-15T00:00:00Z"},
      {"achievement_id": "collector", "unlocked_at": "2026-11-12T00:00:00Z"}]'
  ) where achievement_id = 'collector'),
  '2026-11-12T00:00:00Z'::timestamptz,
  'an achievement sent twice keeps the earlier time'
);
select is(
  (select count(*)::integer from public.merge_achievements('[]')),
  5,
  'nothing sent reads the account''s set'
);

select throws_ok(
  $$select public.merge_achievements('{"achievement_id": "firstSwat"}')$$,
  '22023',
  null,
  'what is not an array is refused'
);
select throws_ok(
  $$select public.merge_achievements((
      select jsonb_agg(jsonb_build_object('achievement_id', 'a' || n, 'unlocked_at', now()))
      from generate_series(1, 65) as n
    ))$$,
  '22023',
  null,
  'more than 64 achievements at once are refused'
);
select throws_ok(
  $$select public.merge_achievements('[{"achievement_id": "firstSwat"}, 7]')$$,
  '22023',
  null,
  'an achievement without its id or its time is refused'
);
select throws_ok(
  $$select public.merge_achievements(
      '[{"achievement_id": "firstSwat", "unlocked_at": "not a time"}]'
    )$$,
  '22007',
  null,
  'a time that is not one is refused'
);

-- Signed in with no player: the role without a subject.
select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok(
  $$select public.merge_achievements('[]')$$,
  '28000',
  null,
  'a call without a player is refused'
);
reset role;

select is(
  (select unlocked_at from public.achievements
    where user_id = '00000000-0000-4000-8000-00000000000b' and achievement_id = 'firstSwat'),
  '2026-11-01T00:00:00Z'::timestamptz,
  'the achievements of another player are left as they are'
);

select * from finish();
rollback;
