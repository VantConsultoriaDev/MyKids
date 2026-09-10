-- Materias e temas de estudo do MyKids.
-- Execute depois de supabase-provision-family.sql.

create table if not exists public.study_subjects (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text not null default '',
  topics jsonb not null default '[]'::jsonb check (jsonb_typeof(topics) = 'array'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_subjects_family_child_idx on public.study_subjects(family_id, child_id);

alter table public.study_subjects enable row level security;

drop policy if exists "family members can read study subjects" on public.study_subjects;
drop policy if exists "family responsible can create study subjects" on public.study_subjects;
drop policy if exists "family responsible can update study subjects" on public.study_subjects;
drop policy if exists "family responsible can delete study subjects" on public.study_subjects;

create policy "family members can read study subjects" on public.study_subjects
  for select using (public.is_family_member(family_id));
create policy "family responsible can create study subjects" on public.study_subjects
  for insert with check (
    public.is_family_responsible(family_id)
    and created_by = auth.uid()
    and exists (select 1 from public.children c where c.id = child_id and c.family_id = study_subjects.family_id)
  );
create policy "family responsible can update study subjects" on public.study_subjects
  for update using (public.is_family_responsible(family_id))
  with check (public.is_family_responsible(family_id));
create policy "family responsible can delete study subjects" on public.study_subjects
  for delete using (public.is_family_responsible(family_id));

grant select, insert, update, delete on public.study_subjects to authenticated;

-- Atualiza o schema cache usado pela API REST do Supabase.
notify pgrst, 'reload schema';
