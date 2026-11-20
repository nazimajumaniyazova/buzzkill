-- Who may read and write (#216, ADR-0007). The boards are public, so anyone reads every table.
-- A run reaches `runs` only through `submit-run` (#218), which plays its replay again and writes
-- with the service role; that role bypasses Row Level Security, so no policy lets anyone else in.
-- A player writes their own profile and achievements, nothing more.
--
-- Two layers. The policies say which rows a role may touch. The grants say which statements and
-- columns it may use at all: Supabase grants every statement on a new table to `anon` and
-- `authenticated`, and a statement with no policy would quietly change no row. Revoking it
-- makes the same attempt fail with "permission denied", which a client and a test can see.
--
-- `anon` is a visitor who has not signed in. An anonymous account of Supabase Auth has the
-- `authenticated` role, like a linked one, and `auth.uid()` is its id. It is read through
-- `(select auth.uid())` so Postgres evaluates it once per statement instead of once per row.

-- Runs: read by anyone, written only by the service role.
revoke insert, update, delete, truncate on public.runs from anon, authenticated;

create policy "anyone reads the runs" on public.runs
  for select to anon, authenticated
  using (true);

-- Profiles: read by anyone. A player creates their own and changes only its nickname; the
-- profile goes when the account is deleted (`on delete cascade`).
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
grant insert (id, nickname) on public.profiles to authenticated;
grant update (nickname) on public.profiles to authenticated;

create policy "anyone reads the profiles" on public.profiles
  for select to anon, authenticated
  using (true);

create policy "a player creates their profile" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "a player renames their profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Achievements: read by anyone. A player records their own, with the time the device saw it
-- unlocked, which the merge of #221 needs; a recorded achievement never changes.
revoke insert, update, delete, truncate on public.achievements from anon, authenticated;
grant insert (user_id, achievement_id, unlocked_at) on public.achievements to authenticated;

create policy "anyone reads the achievements" on public.achievements
  for select to anon, authenticated
  using (true);

create policy "a player records their achievements" on public.achievements
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
