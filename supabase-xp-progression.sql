-- Progressao de XP: execute depois do schema principal.
-- A chave unica evita que uma mesma atividade seja recompensada duas vezes no mesmo dia.

create table if not exists public.child_progression (
  child_id uuid primary key references public.children(id) on delete cascade,
  total_xp integer not null default 0 check (total_xp >= 0),
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  activity_id text not null,
  activity_name text not null,
  activity_type text not null check (activity_type in ('repetitive', 'study', 'special')),
  completed_on date not null,
  base_xp integer not null default 0 check (base_xp >= 0),
  effective_xp integer not null default 0 check (effective_xp >= 0),
  points integer not null default 0 check (points >= 0),
  level_at_completion integer not null check (level_at_completion >= 1),
  reason text not null,
  created_at timestamptz not null default now(),
  unique (child_id, activity_id, completed_on)
);

alter table public.child_progression enable row level security;
alter table public.xp_transactions enable row level security;

drop policy if exists "family members can read child progression" on public.child_progression;
create policy "family members can read child progression"
on public.child_progression for select
using (public.is_family_member((select family_id from public.children where id = child_progression.child_id)));

drop policy if exists "family members can read xp transactions" on public.xp_transactions;
create policy "family members can read xp transactions"
on public.xp_transactions for select
using (public.is_family_member((select family_id from public.children where id = xp_transactions.child_id)));

create or replace function public.xp_required_for_level(p_level integer)
returns integer
language sql immutable
as $$ select ceil(100 * power(1.5, greatest(0, p_level - 1)))::integer $$;

create or replace function public.award_child_xp(
  p_child_id uuid,
  p_activity_id text,
  p_activity_name text,
  p_activity_type text,
  p_completed_on date,
  p_base_xp integer,
  p_points integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_total_xp integer;
  v_level integer := 1;
  v_current integer;
  v_required integer;
  v_multiplier numeric;
  v_effective integer;
  v_existing uuid;
begin
  select family_id into v_family_id from public.children where id = p_child_id;
  if v_family_id is null or not public.is_family_member(v_family_id) then
    raise exception 'Child is outside the current family';
  end if;
  select id into v_existing from public.xp_transactions where child_id = p_child_id and activity_id = p_activity_id and completed_on = p_completed_on;
  if v_existing is not null then return jsonb_build_object('awarded', false, 'transaction_id', v_existing); end if;
  select total_xp into v_total_xp from public.child_progression where child_id = p_child_id for update;
  if v_total_xp is null then v_total_xp := 0; insert into public.child_progression(child_id) values (p_child_id); end if;
  v_current := v_total_xp;
  loop
    v_required := public.xp_required_for_level(v_level);
    exit when v_current < v_required;
    v_current := v_current - v_required;
    v_level := v_level + 1;
  end loop;
  v_multiplier := case p_activity_type when 'repetitive' then greatest(.25, 1 / (1 + .18 * (v_level - 1))) when 'study' then greatest(.70, 1 / (1 + .08 * (v_level - 1))) else 1 end;
  v_effective := case when p_base_xp > 0 then greatest(1, round(p_base_xp * v_multiplier)) else 0 end;
  insert into public.xp_transactions(child_id, activity_id, activity_name, activity_type, completed_on, base_xp, effective_xp, points, level_at_completion, reason)
  values (p_child_id, p_activity_id, p_activity_name, p_activity_type, p_completed_on, greatest(p_base_xp, 0), v_effective, greatest(p_points, 0), v_level, p_reason)
  returning id into v_existing;
  update public.child_progression set total_xp = total_xp + v_effective, points = points + greatest(p_points, 0), updated_at = now() where child_id = p_child_id;
  return jsonb_build_object('awarded', true, 'transaction_id', v_existing, 'effective_xp', v_effective, 'level', v_level);
end;
$$;

grant execute on function public.xp_required_for_level(integer) to authenticated;
grant execute on function public.award_child_xp(uuid, text, text, text, date, integer, integer, text) to authenticated;