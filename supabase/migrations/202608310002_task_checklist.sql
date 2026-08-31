alter table public.events
  add column if not exists checklist jsonb not null default '[]'::jsonb;

alter table public.events
  drop constraint if exists events_checklist_array_check;

alter table public.events
  add constraint events_checklist_array_check
  check (jsonb_typeof(checklist) = 'array');
