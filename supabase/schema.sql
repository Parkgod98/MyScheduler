create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  starts_at timestamptz not null,
  notes text not null default '',
  reminder_minutes integer not null default 10 check (reminder_minutes >= 0 and reminder_minutes <= 10080),
  category text not null default 'general' check (category in ('deadline', 'exam', 'result', 'interview', 'general')),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reminder_deliveries (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  remind_at timestamptz not null,
  sent_at timestamptz,
  primary key (event_id, remind_at)
);

alter table public.events enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminder_deliveries enable row level security;

create policy "events own rows" on public.events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "push own rows" on public.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "deliveries own rows" on public.reminder_deliveries for select using (auth.uid() = user_id);

create index if not exists events_user_starts_idx on public.events(user_id, starts_at);
create index if not exists events_user_completed_starts_idx on public.events(user_id, completed, starts_at);
create index if not exists push_user_idx on public.push_subscriptions(user_id);
