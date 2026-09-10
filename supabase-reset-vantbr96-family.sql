-- Use somente se esta conta ainda possuir a família demonstrativa criada por engano.
-- O comando remove apenas os dados vinculados ao e-mail informado.

begin;

delete from public.families
where owner_id = (
  select id from auth.users where lower(email) = lower('vantbr96@gmail.com')
);

update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
  - 'family_name'
  - 'children'
  - 'objectives'
  - 'onboarding_complete'
where lower(email) = lower('vantbr96@gmail.com');

commit;

notify pgrst, 'reload schema';
