-- Auditoria das estruturas usadas pelo MyKids.
-- Execute no SQL Editor do Supabase para verificar tabelas, colunas, RLS e dados.

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('families', 'family_members', 'children', 'activities', 'activity_occurrences', 'child_progression', 'xp_transactions')
order by table_name;

select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('families', 'family_members', 'children', 'activities', 'activity_occurrences', 'child_progression', 'xp_transactions')
order by table_name, ordinal_position;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('families', 'family_members', 'children', 'activities', 'activity_occurrences', 'child_progression', 'xp_transactions')
order by tablename;

select
  a.id,
  a.family_id,
  a.child_id,
  a.kind,
  a.name,
  a.subject,
  a.subtopic,
  a.xp_base,
  a.points_base,
  a.recurrence,
  a.created_by,
  a.created_at,
  a.updated_at
from public.activities a
order by a.created_at desc;

select
  ao.activity_id,
  ao.child_id,
  ao.occurrence_date,
  ao.status,
  ao.completed_by,
  ao.completed_at
from public.activity_occurrences ao
order by ao.occurrence_date desc, ao.updated_at desc;

select count(*) as activities_total from public.activities;
select count(*) as study_activities from public.activities where kind = 'study';
select count(*) as responsibility_activities from public.activities where kind = 'responsibility';
select count(*) as activity_occurrences_total from public.activity_occurrences;
