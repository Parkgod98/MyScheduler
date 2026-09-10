alter table public.events
  add column if not exists ends_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_valid_range'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_valid_range
      check (ends_at is null or ends_at >= starts_at);
  end if;
end $$;

create index if not exists events_user_ends_idx
  on public.events(user_id, ends_at)
  where ends_at is not null;

drop function if exists public.get_subscribed_events(timestamptz, timestamptz);

create function public.get_subscribed_events(range_start timestamptz, range_end timestamptz)
returns table(
  id uuid,
  owner_id uuid,
  owner_name text,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  category text,
  completed boolean
)
language sql
security definer
set search_path = public
as $$
  select e.id, e.user_id, p.display_name, e.title, e.starts_at, e.ends_at, e.category, e.completed
  from public.calendar_subscriptions s
  join public.calendar_profiles p on p.user_id = s.owner_id and p.sharing_enabled = true
  join public.events e on e.user_id = s.owner_id
  where s.subscriber_id = auth.uid()
    and e.starts_at < range_end
    and coalesce(e.ends_at, e.starts_at) >= range_start
  order by e.starts_at;
$$;

revoke all on function public.get_subscribed_events(timestamptz, timestamptz) from public;
grant execute on function public.get_subscribed_events(timestamptz, timestamptz) to authenticated;
