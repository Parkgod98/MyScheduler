create table if not exists public.calendar_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'MyScheduler 사용자',
  share_code text not null unique default lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  sharing_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_subscriptions (
  subscriber_id uuid not null references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (subscriber_id, owner_id),
  check (subscriber_id <> owner_id)
);

alter table public.calendar_profiles enable row level security;
alter table public.calendar_subscriptions enable row level security;

drop policy if exists "profiles own row" on public.calendar_profiles;
create policy "profiles own row" on public.calendar_profiles
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "subscriptions own row" on public.calendar_subscriptions;
create policy "subscriptions own row" on public.calendar_subscriptions
for all using (auth.uid() = subscriber_id) with check (auth.uid() = subscriber_id);

create or replace function public.ensure_calendar_profile()
returns table(display_name text, share_code text, sharing_enabled boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.calendar_profiles(user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  return query
  select p.display_name, p.share_code, p.sharing_enabled
  from public.calendar_profiles p
  where p.user_id = auth.uid();
end;
$$;

create or replace function public.subscribe_calendar(code text)
returns table(owner_id uuid, display_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.calendar_profiles%rowtype;
begin
  select * into target
  from public.calendar_profiles
  where share_code = lower(trim(code)) and sharing_enabled = true;

  if target.user_id is null then
    raise exception '공개된 캘린더를 찾지 못했습니다.';
  end if;
  if target.user_id = auth.uid() then
    raise exception '내 캘린더는 구독할 수 없습니다.';
  end if;

  insert into public.calendar_subscriptions(subscriber_id, owner_id)
  values (auth.uid(), target.user_id)
  on conflict do nothing;

  return query select target.user_id, target.display_name;
end;
$$;

create or replace function public.unsubscribe_calendar(target_owner uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.calendar_subscriptions
  where subscriber_id = auth.uid() and owner_id = target_owner;
$$;

create or replace function public.get_calendar_subscriptions()
returns table(owner_id uuid, display_name text)
language sql
security definer
set search_path = public
as $$
  select p.user_id, p.display_name
  from public.calendar_subscriptions s
  join public.calendar_profiles p on p.user_id = s.owner_id
  where s.subscriber_id = auth.uid() and p.sharing_enabled = true
  order by p.display_name;
$$;

create or replace function public.get_subscribed_events(range_start timestamptz, range_end timestamptz)
returns table(
  id uuid,
  owner_id uuid,
  owner_name text,
  title text,
  starts_at timestamptz,
  category text,
  completed boolean
)
language sql
security definer
set search_path = public
as $$
  select e.id, e.user_id, p.display_name, e.title, e.starts_at, e.category, e.completed
  from public.calendar_subscriptions s
  join public.calendar_profiles p on p.user_id = s.owner_id and p.sharing_enabled = true
  join public.events e on e.user_id = s.owner_id
  where s.subscriber_id = auth.uid()
    and e.starts_at >= range_start
    and e.starts_at < range_end
  order by e.starts_at;
$$;

grant execute on function public.ensure_calendar_profile() to authenticated;
grant execute on function public.subscribe_calendar(text) to authenticated;
grant execute on function public.unsubscribe_calendar(uuid) to authenticated;
grant execute on function public.get_calendar_subscriptions() to authenticated;
grant execute on function public.get_subscribed_events(timestamptz, timestamptz) to authenticated;
