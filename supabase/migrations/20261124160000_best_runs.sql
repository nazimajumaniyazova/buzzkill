-- The boards (#220): each player's best run of each board, with the nickname the board shows.
-- A board is the rows of one mode, one difficulty and, for the daily challenge, one day; the
-- client orders them by score, the earlier run first on a tie, and takes the top 10.
--
-- One row per player: otherwise one player's runs could fill a whole board. Only runs at 100 %
-- count (ADR-0014); slower ones stay in `runs` as the player's personal records. The replay stays
-- out, since a board downloads only what it shows; a row's id fetches it (#219).
--
-- The filters of a board name only the `distinct on` columns, so Postgres moves them into the
-- view and reads the board's index of `runs`. `runs.user_id` and `profiles.id` both reference
-- `auth.users`, with no key between them for the REST API to follow, so the view joins them.
create view public.best_runs
with (security_invoker = true)
as
select distinct on (run.user_id, run.mode, run.difficulty, run.daily_date)
  run.id,
  run.user_id,
  profile.nickname,
  run.mode,
  run.daily_date,
  run.difficulty,
  run.hero_id,
  run.score,
  run.level,
  run.ticks,
  run.status,
  run.created_at
from public.runs as run
left join public.profiles as profile on profile.id = run.user_id
where run.speed = 100
order by run.user_id, run.mode, run.difficulty, run.daily_date, run.score desc, run.created_at;

comment on view public.best_runs is
  'Each player''s best run at 100 % of each board (#220): of a mode, a difficulty and a day.';

-- Supabase grants every statement on a new relation to the API roles. The view is read only:
-- `security_invoker` makes the policies of `runs` and `profiles` hold, and `distinct on` leaves
-- nothing to write through, but a revoked statement fails plainly instead.
revoke all on public.best_runs from anon, authenticated;
grant select on public.best_runs to anon, authenticated;
