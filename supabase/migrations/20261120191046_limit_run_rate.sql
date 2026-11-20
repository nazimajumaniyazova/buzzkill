-- How fast a player may submit runs (#235, ADR-0009). A valid replay costs nothing to make: one in
-- which the hero never moves verifies, and a script could store thousands of them in the free
-- plan's 500 MB. But no run plays faster than real time, at 60 ticks a second, so an honest
-- player's runs stored in the last hour hold at most an hour of ticks, and the one run that began
-- before the hour: 3,600 × 60 + 54,000 (`MAX_RUN_TICKS` of `@buzzkill/server`, 15 minutes).
-- Slower speeds (ADR-0014) only make the same ticks take longer.

-- The sum below reads a player's last hour from the index alone.
create index runs_by_player_recent on public.runs (user_id, created_at) include (ticks);

-- Over the limit the insert fails with SQLSTATE PT429, which PostgREST answers as HTTP 429; the
-- hint holds the seconds until the hour has room for the run, for the function's Retry-After.
create function public.limit_run_ticks()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  hour_limit constant integer := 3600 * 60 + 54000;
  ticks_this_hour bigint;
  oldest record;
  wait_seconds integer := 3600;
begin
  -- A player's runs are stored one at a time, so requests sent together cannot all pass the
  -- check before any of them is counted. The lock ends with the transaction.
  perform pg_advisory_xact_lock(hashtextextended('runs:' || new.user_id::text, 0));

  select coalesce(sum(ticks), 0) into ticks_this_hour
  from public.runs
  where user_id = new.user_id and created_at > now() - interval '1 hour';

  if ticks_this_hour + new.ticks <= hour_limit then
    return new;
  end if;

  -- The wait: until enough of the hour's oldest runs have left it.
  for oldest in
    select created_at, ticks from public.runs
    where user_id = new.user_id and created_at > now() - interval '1 hour'
    order by created_at
  loop
    ticks_this_hour := ticks_this_hour - oldest.ticks;
    if ticks_this_hour + new.ticks <= hour_limit then
      wait_seconds := greatest(
        1, ceil(extract(epoch from oldest.created_at + interval '1 hour' - now()))
      );
      exit;
    end if;
  end loop;

  raise exception using
    errcode = 'PT429',
    message = 'a player cannot submit more play than an hour holds',
    hint = wait_seconds::text;
end;
$$;

revoke all on function public.limit_run_ticks() from public, anon, authenticated;

create trigger limit_run_ticks
before insert on public.runs
for each row execute function public.limit_run_ticks();
