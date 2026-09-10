-- Provas, questoes e tentativas do MyKids.
-- Execute depois de supabase-activities.sql.

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  name text not null check (char_length(trim(name)) between 1 and 120),
  scheduled_date date not null,
  start_time time not null,
  duration_minutes integer not null default 30 check (duration_minutes between 1 and 1440),
  subjects jsonb not null check (jsonb_typeof(subjects) = 'array' and jsonb_array_length(subjects) > 0),
  question_count integer not null default 15 check (question_count = 15),
  xp_total integer not null default 0 check (xp_total >= 0),
  points_total integer not null default 0 check (points_total >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.exams add column if not exists xp_total integer not null default 0;
alter table public.exams add column if not exists points_total integer not null default 0;
alter table public.exams add column if not exists duration_minutes integer not null default 30;
alter table public.exams add column if not exists creation_key uuid;
create unique index if not exists exams_creation_key_idx on public.exams(creation_key) where creation_key is not null;
alter table public.exams drop constraint if exists exams_question_count_check;
alter table public.exams add constraint exams_question_count_check check (question_count between 1 and 40);

create table if not exists public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  position integer not null check (position between 1 and 15),
  question_type text not null check (question_type in ('multiple_choice', 'open')),
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  correct_option text,
  reference_answer text,
  xp numeric(6,2) not null default 0,
  points numeric(6,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (exam_id, position),
  check ((question_type = 'multiple_choice' and jsonb_array_length(options) = 5 and correct_option is not null) or (question_type = 'open' and reference_answer is not null))
);

alter table public.exam_questions add column if not exists xp numeric(6,2) not null default 0;
alter table public.exam_questions add column if not exists points numeric(6,2) not null default 0;
alter table public.exam_questions drop constraint if exists exam_questions_position_check;
alter table public.exam_questions add constraint exam_questions_position_check check (position between 1 and 40);

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  started_at timestamptz,
  submitted_at timestamptz,
  score numeric(6,2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'submitted', 'reviewed')),
  unique (exam_id, child_id)
);

create table if not exists public.exam_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_id uuid not null references public.exam_questions(id) on delete cascade,
  answer_text text,
  is_correct boolean,
  awarded_points numeric(6,2) not null default 0,
  ai_feedback text,
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index if not exists exams_family_child_date_idx on public.exams(family_id, child_id, scheduled_date);
create index if not exists exam_questions_exam_idx on public.exam_questions(exam_id, position);

alter table public.exams enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.exam_answers enable row level security;

drop policy if exists "family members can read exams" on public.exams;
drop policy if exists "family responsible can create exams" on public.exams;
drop policy if exists "family responsible can update exams" on public.exams;
drop policy if exists "family responsible can delete exams" on public.exams;
drop policy if exists "family members can read exam questions" on public.exam_questions;
drop policy if exists "family responsible can create exam questions" on public.exam_questions;
drop policy if exists "family responsible can update exam questions" on public.exam_questions;
drop policy if exists "family responsible can delete exam questions" on public.exam_questions;
drop policy if exists "family members can read exam attempts" on public.exam_attempts;
drop policy if exists "family members can create exam attempts" on public.exam_attempts;
drop policy if exists "family members can update exam attempts" on public.exam_attempts;
drop policy if exists "family members can read exam answers" on public.exam_answers;
drop policy if exists "family members can create exam answers" on public.exam_answers;
drop policy if exists "family members can update exam answers" on public.exam_answers;

create policy "family members can read exams" on public.exams for select using (public.is_family_member(family_id));
create policy "family responsible can create exams" on public.exams for insert with check (public.is_family_responsible(family_id) and created_by = auth.uid() and exists (select 1 from public.children c where c.id = child_id and c.family_id = exams.family_id));
create policy "family responsible can update exams" on public.exams for update using (public.is_family_responsible(family_id)) with check (public.is_family_responsible(family_id));
create policy "family responsible can delete exams" on public.exams for delete using (public.is_family_responsible(family_id));

create policy "family members can read exam questions" on public.exam_questions for select using (exists (select 1 from public.exams e where e.id = exam_id and public.is_family_member(e.family_id)));
create policy "family responsible can create exam questions" on public.exam_questions for insert with check (exists (select 1 from public.exams e where e.id = exam_id and public.is_family_responsible(e.family_id)));
create policy "family responsible can update exam questions" on public.exam_questions for update using (exists (select 1 from public.exams e where e.id = exam_id and public.is_family_responsible(e.family_id)));
create policy "family responsible can delete exam questions" on public.exam_questions for delete using (exists (select 1 from public.exams e where e.id = exam_id and public.is_family_responsible(e.family_id)));

create policy "family members can read exam attempts" on public.exam_attempts for select using (exists (select 1 from public.exams e where e.id = exam_id and public.is_family_member(e.family_id)));
create policy "family members can create exam attempts" on public.exam_attempts for insert with check (exists (select 1 from public.exams e where e.id = exam_id and e.child_id = exam_attempts.child_id and public.is_family_member(e.family_id)));
create policy "family members can update exam attempts" on public.exam_attempts for update using (exists (select 1 from public.exams e where e.id = exam_id and public.is_family_member(e.family_id)));

create policy "family members can read exam answers" on public.exam_answers for select using (exists (select 1 from public.exam_attempts a join public.exams e on e.id = a.exam_id where a.id = attempt_id and public.is_family_member(e.family_id)));
create policy "family members can create exam answers" on public.exam_answers for insert with check (exists (select 1 from public.exam_attempts a join public.exams e on e.id = a.exam_id where a.id = attempt_id and public.is_family_member(e.family_id)));
create policy "family members can update exam answers" on public.exam_answers for update using (exists (select 1 from public.exam_attempts a join public.exams e on e.id = a.exam_id where a.id = attempt_id and public.is_family_member(e.family_id)));

grant select, insert, update, delete on public.exams to authenticated;
grant select, insert, update, delete on public.exam_questions to authenticated;
grant select, insert, update on public.exam_attempts to authenticated;
grant select, insert, update on public.exam_answers to authenticated;

drop function if exists public.approve_exam_with_questions;

create or replace function public.approve_exam_with_questions(
  p_creation_key uuid,
  p_child_id uuid,
  p_name text,
  p_scheduled_date date,
  p_start_time time,
  p_duration_minutes integer,
  p_subjects jsonb,
  p_xp_total integer,
  p_points_total integer,
  p_questions jsonb
)
returns public.exams
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_exam public.exams;
  v_question jsonb;
  v_position integer := 0;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  select fm.family_id into v_family_id from public.family_members fm where fm.user_id = v_user_id limit 1;
  if v_family_id is null or not public.is_family_responsible(v_family_id) then raise exception 'Not authorized'; end if;
  if not exists (select 1 from public.children c where c.id = p_child_id and c.family_id = v_family_id) then raise exception 'Child does not belong to family'; end if;
  if p_creation_key is null or p_name is null or char_length(trim(p_name)) = 0 then raise exception 'Invalid exam payload'; end if;
  if jsonb_array_length(p_questions) < 1 or jsonb_array_length(p_questions) > 40 then raise exception 'Invalid question count'; end if;

  select * into v_exam from public.exams where creation_key = p_creation_key limit 1;
  if found then return v_exam; end if;

  insert into public.exams (family_id, child_id, created_by, creation_key, name, scheduled_date, start_time, duration_minutes, subjects, question_count, xp_total, points_total)
  values (v_family_id, p_child_id, v_user_id, p_creation_key, trim(p_name), p_scheduled_date, p_start_time, p_duration_minutes, p_subjects, jsonb_array_length(p_questions), p_xp_total, p_points_total)
  returning * into v_exam;

  for v_question in select * from jsonb_array_elements(p_questions) loop
    v_position := v_position + 1;
    insert into public.exam_questions (exam_id, position, question_type, prompt, options, correct_option, reference_answer, xp, points)
    values (v_exam.id, v_position, v_question->>'type', v_question->>'prompt', coalesce(v_question->'options', '[]'::jsonb), nullif(v_question->>'correctOption', ''), v_question->>'referenceAnswer', greatest(coalesce((v_question->>'xp')::numeric, (v_question->>'points')::numeric, 0.01), 0.01), greatest(coalesce((v_question->>'points')::numeric, 0.01), 0.01));
  end loop;
  return v_exam;
end;
$$;

grant execute on function public.approve_exam_with_questions(uuid, uuid, text, date, time, integer, jsonb, integer, integer, jsonb) to authenticated;

notify pgrst, 'reload schema';
