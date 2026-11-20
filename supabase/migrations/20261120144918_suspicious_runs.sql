-- The log of suspicious attempts (#218, ADR-0009): a submitted replay that the server played to
-- another result than the client claimed. The owner reads it to tell a forger from a bug in the
-- determinism of the game. Only the function writes it, with the service role.
create table public.suspicious_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game_version text not null check (char_length(game_version) between 1 and 32),
  seed bigint not null check (seed between 0 and 4294967295),
  -- `{ score, level, ticks, hash }`, as the client claimed it and as the server found it.
  claimed jsonb not null check (jsonb_typeof(claimed) = 'object'),
  found jsonb not null check (jsonb_typeof(found) = 'object'),
  -- The replay's JSON, gzipped, as in `runs`: enough to play the attempt again.
  replay bytea not null check (octet_length(replay) <= 65536),
  created_at timestamptz not null default now()
);

create index suspicious_runs_by_player on public.suspicious_runs (user_id, created_at desc);

-- No policy: no client reads or writes the log, and the revoke makes them fail loudly rather
-- than see an empty table. The service role bypasses both.
alter table public.suspicious_runs enable row level security;
revoke all on table public.suspicious_runs from anon, authenticated;

-- A forger may send attempt after attempt, and anonymous accounts are free, but each costs up to
-- 64 KiB of a 500 MB database. The first ten attempts of a player in a day are enough to see what
-- they tried; later ones are dropped without an error, so the function answers as before.
create function public.keep_suspicious_runs_few()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    select count(*) from public.suspicious_runs
    where user_id = new.user_id and created_at > now() - interval '1 day'
  ) >= 10 then
    return null;
  end if;
  return new;
end;
$$;

revoke all on function public.keep_suspicious_runs_few() from public, anon, authenticated;

create trigger keep_suspicious_runs_few
before insert on public.suspicious_runs
for each row execute function public.keep_suspicious_runs_few();
