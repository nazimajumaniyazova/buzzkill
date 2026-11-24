-- The merge of a device's achievements into the account's (#221). On sign-in, the device sends
-- what it has unlocked and reads back the account's whole set, in one call. An achievement on both
-- sides keeps the earlier time, so playing on a second device loses nothing.
--
-- Players may only insert achievements (#216), and an achievement sent again must be able to move
-- to an earlier time. Rather than letting players update the table, this one function does it,
-- as its owner: it writes only the caller's rows, and a time only ever moves earlier, never past
-- now.

create function public.merge_achievements(unlocked jsonb)
returns setof public.achievements
language plpgsql
security definer
set search_path = ''
as $$
declare
  player uuid := auth.uid();
begin
  if player is null then
    raise exception using
      errcode = '28000',
      message = 'only a signed-in player merges achievements';
  end if;
  if jsonb_typeof(unlocked) is distinct from 'array' then
    raise exception using
      errcode = '22023',
      message = 'achievements come as an array';
  end if;
  if jsonb_array_length(unlocked) > 64 then
    raise exception using
      errcode = '22023',
      message = 'at most 64 achievements come at once';
  end if;
  if exists (
    select from jsonb_array_elements(unlocked) as item
    where jsonb_typeof(item) is distinct from 'object'
      or item ->> 'achievement_id' is null
      or item ->> 'unlocked_at' is null
  ) then
    raise exception using
      errcode = '22023',
      message = 'each achievement comes with its achievement_id and its unlocked_at';
  end if;

  -- One row per achievement at its earliest time sent: a conflict may touch a row only once.
  insert into public.achievements as kept (user_id, achievement_id, unlocked_at)
  select player, item ->> 'achievement_id', least(min((item ->> 'unlocked_at')::timestamptz), now())
  from jsonb_array_elements(unlocked) as item
  group by item ->> 'achievement_id'
  on conflict (user_id, achievement_id)
  do update set unlocked_at = least(kept.unlocked_at, excluded.unlocked_at);

  return query
  select * from public.achievements where user_id = player order by achievement_id;
end;
$$;

revoke all on function public.merge_achievements(jsonb) from public, anon;
grant execute on function public.merge_achievements(jsonb) to authenticated;
