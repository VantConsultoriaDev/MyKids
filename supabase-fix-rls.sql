-- Execute este arquivo no Supabase SQL Editor.
-- Ele corrige o provisionamento da primeira família sem desativar RLS.

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.children enable row level security;

create policy "mykids owners can create families"
on public.families
for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy "mykids owners can read their families"
on public.families
for select
using (
  owner_id = (select auth.uid())
  or public.is_family_member(id)
);

create policy "mykids users can create own membership"
on public.family_members
for insert
 to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.families
    where families.id = family_members.family_id
      and families.owner_id = (select auth.uid())
  )
);

create policy "mykids users can read own membership"
on public.family_members
for select
using (
  user_id = (select auth.uid())
  or public.is_family_responsible(family_id)
);

create policy "mykids responsible can create children"
on public.children
for insert
 to authenticated
with check (public.is_family_responsible(family_id));

create policy "mykids members can read children"
on public.children
for select
using (public.is_family_member(family_id));
