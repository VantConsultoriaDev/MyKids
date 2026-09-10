-- Atividades do responsavel: estudos e responsabilidades.
-- Execute depois do schema principal e das funcoes de isolamento da familia.

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  kind text not null check (kind in ('study', 'responsibility')),
  name text not null check (char_length(trim(name)) between 1 and 120),
  subject text,
  subtopic text,
  recurrence jsonb not null default '{"type":"daily","weekdays":[],"day_of_month":null}'::jsonb,
  start_time time,
  duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 1440),
  notes text,
  xp_base integer not null default 0 check (xp_base >= 0),
  points_base integer not null default 0 check (points_base >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_requires_subject check (kind <> 'study' or nullif(trim(subject), '') is not null),
  constraint recurrence_shape check (
    recurrence ? 'type'
    and recurrence->>'type' in ('daily', 'weekly', 'monthly', 'custom')
  )
);

alter table public.activities add column if not exists xp_base integer not null default 0;
alter table public.activities add column if not exists points_base integer not null default 0;

create table if not exists public.activity_occurrences (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  occurrence_date date not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'missed')),
  completed_by uuid references auth.users(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, occurrence_date)
);

create index if not exists activities_family_child_idx on public.activities(family_id, child_id, active);
create index if not exists activity_occurrences_date_idx on public.activity_occurrences(child_id, occurrence_date);

alter table public.activities enable row level security;
alter table public.activity_occurrences enable row level security;

drop policy if exists "family members can read activities" on public.activities;
create policy "family members can read activities" on public.activities for select
using (public.is_family_member(family_id));

drop policy if exists "family responsible can create activities" on public.activities;
create policy "family responsible can create activities" on public.activities for insert
with check (
  public.is_family_responsible(family_id)
  and exists (select 1 from public.children c where c.id = child_id and c.family_id = activities.family_id)
  and created_by = auth.uid()
);

drop policy if exists "family responsible can update activities" on public.activities;
create policy "family responsible can update activities" on public.activities for update
using (public.is_family_responsible(family_id))
with check (
  public.is_family_responsible(family_id)
  and exists (select 1 from public.children c where c.id = child_id and c.family_id = activities.family_id)
);

drop policy if exists "family responsible can delete activities" on public.activities;
create policy "family responsible can delete activities" on public.activities for delete
using (public.is_family_responsible(family_id));

drop policy if exists "family members can read activity occurrences" on public.activity_occurrences;
create policy "family members can read activity occurrences" on public.activity_occurrences for select
using (exists (select 1 from public.activities a where a.id = activity_id and public.is_family_member(a.family_id)));

drop policy if exists "family members can write activity occurrences" on public.activity_occurrences;
create policy "family members can write activity occurrences" on public.activity_occurrences for insert
with check (exists (select 1 from public.activities a where a.id = activity_id and a.child_id = activity_occurrences.child_id and public.is_family_member(a.family_id)));

drop policy if exists "family members can update activity occurrences" on public.activity_occurrences;
create policy "family members can update activity occurrences" on public.activity_occurrences for update
using (exists (select 1 from public.activities a where a.id = activity_id and public.is_family_member(a.family_id)))
with check (exists (select 1 from public.activities a where a.id = activity_id and a.child_id = activity_occurrences.child_id and public.is_family_member(a.family_id)));

create or replace function public.validate_activity_payload()
returns trigger language plpgsql as $$
begin
  if new.kind = 'study' and nullif(trim(new.subject), '') is null then raise exception 'Study activities require a subject'; end if;
  if new.recurrence->>'type' in ('weekly', 'custom') and jsonb_array_length(coalesce(new.recurrence->'weekdays', '[]'::jsonb)) = 0 then raise exception 'Weekly and custom recurrence require weekdays'; end if;
  if new.recurrence->>'type' = 'monthly' and ((new.recurrence->>'day_of_month')::integer not between 1 and 31) then raise exception 'Monthly recurrence requires a valid day'; end if;
  return new;
end;
$$;

drop trigger if exists validate_activity_payload on public.activities;
create trigger validate_activity_payload before insert or update on public.activities
for each row execute function public.validate_activity_payload();

grant select, insert, update, delete on public.activities to authenticated;
grant select, insert, update on public.activity_occurrences to authenticated;

notify pgrst, 'reload schema';