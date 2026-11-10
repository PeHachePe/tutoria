-- Step 2.1 · Every new Supabase Auth user gets their app_user row, always as a student.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email, raw_user_meta_data) values
  ('99999999-0000-4000-8000-000000000001', 'nueva@tutoria.test', '{"name": "Nueva Alumna", "role": "admin"}'),
  ('99999999-0000-4000-8000-000000000002', 'sin.nombre@tutoria.test', '{}');

select is(
  (select role::text from app_user where id = '99999999-0000-4000-8000-000000000001'),
  'student',
  'a new user is a student, whatever role the metadata claims'
);
select is(
  (select name from app_user where id = '99999999-0000-4000-8000-000000000001'),
  'Nueva Alumna',
  'the name comes from the metadata'
);
select is(
  (select name from app_user where id = '99999999-0000-4000-8000-000000000002'),
  'sin.nombre',
  'without a name, the part of the email before the @'
);

select * from finish();
rollback;
