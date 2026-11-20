-- The tables of stage 8 (#215, ADR-0007): the players' profiles, their verified runs and their
-- achievements. Row Level Security is on from the start and no policy exists yet, so no client
-- can read or write until #216 says who may.

-- The values the game knows, as enums: the generated database types then name the same unions
-- as `@buzzkill/game`, and a test compares them. A new hero or difficulty adds a label here.
create type public.run_mode as enum ('classic', 'daily');
create type public.difficulty as enum ('easy', 'normal', 'hard');
create type public.hero_id as enum ('male', 'female', 'sam', 'leo');
create type public.time_of_day as enum ('day', 'night');
-- Only a run that is over is stored: one cut short at the server's tick limit is refused (#218).
create type public.run_status as enum ('won', 'lost');

-- The public face of an account on the boards. The rules of a nickname come with #217.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 32),
  created_at timestamptz not null default now()
);

-- A run that the server played again and found as claimed (#218, ADR-0009). Every column but
-- the speed comes from the replay or from the result of `simulate`.
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode public.run_mode not null,
  -- The UTC day of a daily run (#165); a classic run has none.
  daily_date date,
  difficulty public.difficulty not null,
  hero_id public.hero_id not null,
  -- The time of day the run started in: the replay's `mode`.
  time_of_day public.time_of_day not null,
  -- The game speed in percent (ADR-0014). The client reports it and nothing can prove it, so
  -- only runs at 100 enter the boards; slower ones count as personal records.
  speed smallint not null check (speed in (50, 75, 100)),
  game_version text not null check (char_length(game_version) between 1 and 32),
  -- A replay's seed is an unsigned 32-bit integer, which `integer` cannot hold.
  seed bigint not null check (seed between 0 and 4294967295),
  score integer not null check (score >= 0),
  level smallint not null check (level between 1 and 6),
  ticks integer not null check (ticks > 0),
  status public.run_status not null,
  -- FNV-1a of the final state, as `simulate` reports it.
  state_hash text not null check (state_hash ~ '^[0-9a-f]{8}$'),
  -- The replay's JSON, gzipped. A whole campaign takes about 2 kB; the limit only stops abuse,
  -- and the function checks its own, smaller one first (#218).
  replay bytea not null check (octet_length(replay) <= 65536),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint runs_daily_has_its_date check ((mode = 'daily') = (daily_date is not null)),
  -- Every daily run starts by day at the normal difficulty (`DAILY` in `@buzzkill/game`).
  constraint runs_daily_is_the_same_for_everyone check (
    mode = 'classic' or (difficulty = 'normal' and time_of_day = 'day')
  )
);

-- The boards read the best runs at 100 %: of a difficulty, and of a day.
create index runs_classic_board on public.runs (difficulty, score desc, created_at)
  where mode = 'classic' and speed = 100;
create index runs_daily_board on public.runs (daily_date, score desc, created_at)
  where mode = 'daily' and speed = 100;
-- A player's own runs, at any speed: the personal records and the account's history.
create index runs_by_player on public.runs (user_id, mode, score desc);

-- The achievements of an account (#163, #221). The ids are the game's; the merge on sign-in
-- keeps the earlier `unlocked_at` of the device's and the account's.
create table public.achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null check (char_length(achievement_id) between 1 and 64),
  unlocked_at timestamptz not null,
  primary key (user_id, achievement_id)
);

alter table public.profiles enable row level security;
alter table public.runs enable row level security;
alter table public.achievements enable row level security;
