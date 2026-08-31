alter table public.events
  add column if not exists category text not null default 'general',
  add column if not exists completed boolean not null default false;

alter table public.events
  drop constraint if exists events_category_check;

alter table public.events
  add constraint events_category_check
  check (category in ('deadline', 'exam', 'result', 'interview', 'general'));

create index if not exists events_user_completed_starts_idx
  on public.events(user_id, completed, starts_at);
