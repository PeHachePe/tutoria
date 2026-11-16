-- Step 2.1 · What teachers and administrators reach (docs/PLAN.md §2.3).
-- Seed users: Marta teaches 1.º DAW A in two subjects (...002, groups ...001 and ...003), Javier
-- teaches 1.º DAM B (...003, group ...002), the administrator is ...001. Lucía (...011) is in both
-- groups of DAW A; Elena (...041), in DAM B.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

create function pg_temp.sign_in(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
end;
$$;

-- Marta
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');

select results_eq(
  'select id from class_group',
  $$ values ('20000000-0000-4000-8000-000000000001'::uuid), ('20000000-0000-4000-8000-000000000003') $$,
  'a teacher only sees their groups'
);
select is(
  (select count(*) from attempt where user_id = '10000000-0000-4000-8000-000000000041'),
  0::bigint,
  'a teacher does not see the attempts of students in other groups'
);
select is(
  (select count(*) from attempt where user_id = '10000000-0000-4000-8000-000000000011'),
  10::bigint,
  'a teacher sees the attempts of their students, practice included'
);
select ok(
  (select count(*) from process_event e join attempt a on a.id = e.attempt_id
   where a.user_id = '10000000-0000-4000-8000-000000000011') > 0,
  'a teacher sees the events of their students'
);
select is((select count(*) from app_user), 25::bigint, 'a teacher reads themselves and their 24 students');
select is((select count(*) from test where is_hidden), 84::bigint, 'a teacher reads the hidden tests');
select is((select count(*) from exercise), 42::bigint, 'teachers share the whole exercise bank');
select lives_ok(
  $$ insert into class_block (group_id, position, title) values ('20000000-0000-4000-8000-000000000001', 10, 'Examen') $$,
  'a teacher adds blocks to their groups'
);
select throws_ok(
  $$ insert into class_block (group_id, position, title) values ('20000000-0000-4000-8000-000000000002', 9, 'Examen') $$,
  '42501', null,
  'a teacher cannot add blocks to the groups of another'
);
select throws_ok(
  $$ delete from exercise where id = '40000000-0000-4000-8000-000000000001' $$,
  '23503', null,
  'an exercise with attempts cannot be deleted'
);
select throws_ok(
  $$ insert into tutor_interaction (attempt_id, trigger, hint_level, transcript, emotion, intensity, prompt_version)
     values ('70000000-0000-4000-8000-000000000001', 'hint', 1, 'x', 'joy', 1, 'v1') $$,
  '42501', null,
  'only the server writes tutor interactions'
);
select is((select count(*) from app_setting), 0::bigint, 'a teacher cannot read the settings');

-- A student of two teachers: Lucía joins 1.º DAM B, of Javier (D-062)
reset role;
insert into enrollment (group_id, user_id)
values ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000011');
create temporary table lucia_attempts on commit drop as
select id from attempt where user_id = '10000000-0000-4000-8000-000000000011';
grant select on lucia_attempts to authenticated;
select pg_temp.sign_in('10000000-0000-4000-8000-000000000003');

select is(
  (select count(*) from attempt where user_id = '10000000-0000-4000-8000-000000000011'),
  0::bigint,
  'a teacher does not see what their students do in the groups of another teacher'
);
select is(
  (select count(*) from process_event where attempt_id in (select id from lucia_attempts)),
  0::bigint,
  'nor its events'
);
select is(
  (select count(*) from tutor_interaction where attempt_id in (select id from lucia_attempts)),
  0::bigint,
  'nor what they asked the tutor there'
);

-- She starts an exercise of Javier's group
reset role;
insert into attempt (exercise_id, user_id, assignment_id) values (
  '40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000011',
  '60000000-0000-4000-8000-000000000101'
);
select pg_temp.sign_in('10000000-0000-4000-8000-000000000003');

select is(
  (select count(*) from attempt where user_id = '10000000-0000-4000-8000-000000000011'),
  1::bigint,
  'a teacher sees the attempts at the assignments of their groups'
);

reset role;
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');
select is(
  (select count(*) from attempt where user_id = '10000000-0000-4000-8000-000000000011'),
  10::bigint,
  'and the other teacher, only those of theirs'
);

-- Administrator: every attempt is the count without RLS, not that of the seed, so the test passes
-- in a local database already used by hand
reset role;
select set_config('test.all_attempts', (select count(*) from attempt)::text, true);
select pg_temp.sign_in('10000000-0000-4000-8000-000000000001');

select is(
  (select count(*) from attempt),
  current_setting('test.all_attempts')::bigint,
  'an administrator sees every attempt'
);
select is((select count(*) from app_setting), 1::bigint, 'an administrator reads the settings');

select * from finish();
rollback;
