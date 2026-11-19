-- Step 5.2a · Groups and enrollment (docs/PLAN.md §2.3, RF-16, D-072).
-- Seed: Marta (...002) teaches 1.º DAW A (group ...001, started, with Lucía ...011) and group ...003;
-- Javier (...003) teaches 1.º DAM B (group ...002, with Elena ...041). Raúl (...050) is a disabled
-- student and the administrator is ...001.
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

create function pg_temp.sign_in(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
end;
$$;

-- How many rows a statement changed: a delete the RLS stops changes none, without an error.
create function pg_temp.changed_rows(statement text) returns bigint language plpgsql as $$
declare
  changed bigint;
begin
  execute statement;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

-- Marta
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');

select is(
  (select array_agg(name) from search_students('VÁZQ', '20000000-0000-4000-8000-000000000001')),
  array['Elena Vázquez Lorenzo'],
  'a teacher finds students of the whole school, without accents or capitals'
);
select throws_ok(
  $$ select search_students(' a ', '20000000-0000-4000-8000-000000000001') $$,
  '22023', null,
  'the search needs two letters'
);
select throws_ok(
  $$ select search_students('elena', '20000000-0000-4000-8000-000000000002') $$,
  'P0002', null,
  'nor for the group of another teacher'
);
select is_empty(
  $$ select * from search_students('%%', '20000000-0000-4000-8000-000000000001') $$,
  'the wildcards are searched as text'
);
select is_empty(
  $$ select * from search_students('raúl', '20000000-0000-4000-8000-000000000001') $$,
  'nor a disabled student'
);
-- With `returning`, as the app asks: the new row passes the policy to read it.
select results_eq(
  $$ insert into class_group (id, name, school_year, teacher_id, subject_id) values
       ('20000000-0000-4000-8000-000000000099', 'Taller', '2026/27',
        '10000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001')
     returning name $$,
  $$ values ('Taller') $$,
  'a teacher creates a group of their own and reads it back'
);
select is(
  (select count(*)::integer from search_students('tutoria', '20000000-0000-4000-8000-000000000099')),
  20,
  'twenty students at most'
);
select throws_ok(
  $$ insert into class_group (name, school_year, teacher_id, subject_id) values
       ('Ajeno', '2026/27', '10000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001') $$,
  '42501', null,
  'and not one of another teacher'
);
select throws_ok(
  $$ update class_group set teacher_id = '10000000-0000-4000-8000-000000000003'
     where id = '20000000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'a teacher does not hand their group over'
);
select throws_ok(
  $$ update class_group set subject_id = 'b0000000-0000-4000-8000-000000000002'
     where id = '20000000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'a group does not change subject'
);
select throws_ok(
  $$ update class_group set school_year = '2026' where id = '20000000-0000-4000-8000-000000000001' $$,
  '23514', null,
  'the school year is like 2026/27'
);
select is(
  (select array_agg(name) from enroll_students('20000000-0000-4000-8000-000000000099', array[
     '10000000-0000-4000-8000-000000000041', '10000000-0000-4000-8000-000000000011']::uuid[])),
  array['Elena Vázquez Lorenzo', 'Lucía Martín Gómez'],
  'a teacher enrolls several students at once and reads their names, in the order given'
);
select throws_ok(
  $$ select enroll_students('20000000-0000-4000-8000-000000000099', array[
       '10000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000050']::uuid[]) $$,
  '23514', null,
  'all or none: a disabled student stops the batch'
);
select is(
  (select count(*)::integer from enrollment where group_id = '20000000-0000-4000-8000-000000000099'),
  2,
  'and nobody of it is enrolled'
);
select throws_ok(
  $$ select enroll_students('20000000-0000-4000-8000-000000000099', array[
       '10000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000012']::uuid[]) $$,
  '22023', null,
  'each student once'
);
select throws_ok(
  $$ select enroll_students('20000000-0000-4000-8000-000000000099', array(
       select gen_random_uuid() from generate_series(1, 51))) $$,
  '22023', null,
  'fifty at most'
);
select throws_ok(
  $$ select enroll_students('20000000-0000-4000-8000-000000000002', array[
       '10000000-0000-4000-8000-000000000012']::uuid[]) $$,
  'P0002', null,
  'nor in the group of another teacher'
);
select throws_ok(
  $$ insert into enrollment (group_id, user_id) values
       ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000041') $$,
  '42501', null,
  'nobody enrolls but through enroll_students, which keeps its limit'
);
select lives_ok(
  $$ select enroll_students('20000000-0000-4000-8000-000000000001', array['10000000-0000-4000-8000-000000000041']::uuid[]) $$,
  'a teacher enrolls a student in their group'
);
select is_empty(
  $$ select * from search_students('elena', '20000000-0000-4000-8000-000000000001') $$,
  'who is no longer found for it'
);
select throws_ok(
  $$ select enroll_students('20000000-0000-4000-8000-000000000001', array['10000000-0000-4000-8000-000000000041']::uuid[]) $$,
  '23505', null,
  'only once'
);
select throws_ok(
  $$ select enroll_students('20000000-0000-4000-8000-000000000001', array['10000000-0000-4000-8000-000000000003']::uuid[]) $$,
  '23514', null,
  'a teacher is not enrolled'
);
select throws_ok(
  $$ select enroll_students('20000000-0000-4000-8000-000000000001', array['10000000-0000-4000-8000-000000000050']::uuid[]) $$,
  '23514', null,
  'nor a disabled student'
);
select is(
  pg_temp.changed_rows($$ delete from enrollment where id = '30000000-0000-4000-8000-000000000025' $$),
  0::bigint,
  'a teacher does not unenroll from the group of another'
);
select is(
  pg_temp.changed_rows($$ delete from enrollment where id = '30000000-0000-4000-8000-000000000001' $$),
  1::bigint,
  'and does from their own'
);
select is(
  pg_temp.changed_rows($$ delete from class_group where id = '20000000-0000-4000-8000-000000000001' $$),
  0::bigint,
  'a started group is not deleted'
);
select is(
  pg_temp.changed_rows($$ delete from class_group where id = '20000000-0000-4000-8000-000000000099' $$),
  1::bigint,
  'one nobody started is'
);
select is(
  (select array_agg(group_id::text || ' ' || student_count || ' ' || is_started order by group_id)
   from group_summaries()),
  array[
    '20000000-0000-4000-8000-000000000001 ' ||
      (select count(*) from enrollment where group_id = '20000000-0000-4000-8000-000000000001') ||
      ' true',
    '20000000-0000-4000-8000-000000000003 ' ||
      (select count(*) from enrollment where group_id = '20000000-0000-4000-8000-000000000003') ||
      ' ' || is_started_group('20000000-0000-4000-8000-000000000003')
  ],
  'a teacher sums up their groups: students and whether started'
);

reset role;

select ok(
  exists (select 1 from attempt where user_id = '10000000-0000-4000-8000-000000000011'),
  'unenrolling keeps the attempts'
);

update app_user set status = 'disabled' where id = '10000000-0000-4000-8000-000000000003';

-- The administrator
select pg_temp.sign_in('10000000-0000-4000-8000-000000000001');

select lives_ok(
  $$ update class_group set teacher_id = '10000000-0000-4000-8000-000000000002'
     where id = '20000000-0000-4000-8000-000000000002' $$,
  'the administrator changes the teacher of a group'
);
select lives_ok(
  $$ update class_group set name = '1.º DAM B (tarde)', teacher_id = '10000000-0000-4000-8000-000000000003'
     where id = '20000000-0000-4000-8000-000000000004' $$,
  'a group of a disabled teacher keeps its name editable until it is handed over'
);
select throws_ok(
  $$ update class_group set teacher_id = '10000000-0000-4000-8000-000000000011'
     where id = '20000000-0000-4000-8000-000000000002' $$,
  '23514', null,
  'not for a student'
);
select throws_ok(
  $$ update class_group set teacher_id = '10000000-0000-4000-8000-000000000003'
     where id = '20000000-0000-4000-8000-000000000002' $$,
  '23514', null,
  'nor for a disabled teacher'
);
select throws_ok(
  $$ update class_group set teacher_id = '10000000-0000-4000-8000-000000000001'
     where id = '20000000-0000-4000-8000-000000000002' $$,
  '23514', null,
  'nor for an administrator'
);

select * from finish();
rollback;
