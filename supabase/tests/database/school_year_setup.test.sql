-- Step 5.2c · Setting up a new school year (docs/PLAN.md §2.3, D-079).
-- Seed: Marta (...002) teaches the class 1.º DAW A 2026/27, groups ...001 (subject ...001, 24
-- students, 9 blocks) and ...003 (subject ...003); Javier (...003) teaches 1.º DAM B (...002).
-- Raúl (...050) is a disabled student and the administrator is ...001.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

create function pg_temp.sign_in(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
end;
$$;

-- Raúl was enrolled before his account was disabled: he is not taken into a copy.
update app_user set status = 'active' where id = '10000000-0000-4000-8000-000000000050';
insert into enrollment (group_id, user_id) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000050');
update app_user set status = 'disabled' where id = '10000000-0000-4000-8000-000000000050';

select is(school_year_shift_days('2026/27', '2027/28'), 364, 'a year later is 52 weeks later');
select is(school_year_shift_days('2026/27', '2026/27'), 0, 'and the same year, no change');
select is(school_year_shift_days('2026/27', '2024/25'), -728, 'also backwards');

-- Marta ---------------------------------------------------------------------------------------------
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');

create temp table copies as
select * from duplicate_groups(
  array['20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003']::uuid[],
  '1.º DAW A', '2027/28', '10000000-0000-4000-8000-000000000002', true, true, true, 'Europe/Madrid'
) with ordinality as t;

select results_eq(
  $$ select name, school_year, subject_id::text from copies order by ordinality $$,
  $$ values ('1.º DAW A', '2027/28', 'b0000000-0000-4000-8000-000000000001'),
            ('1.º DAW A', '2027/28', 'b0000000-0000-4000-8000-000000000003') $$,
  'a teacher duplicates a class: a group for each subject, in the order given'
);
select is(
  (select array_agg(title order by position) from class_block
   where group_id = (select id from copies where ordinality = 1)),
  (select array_agg(title order by position) from class_block
   where group_id = '20000000-0000-4000-8000-000000000001'),
  'with its blocks in their order'
);
select is(
  (select array_agg(position order by position) from class_block
   where group_id = (select id from copies where ordinality = 1)),
  (select array_agg(n::integer) from generate_series(1, 9) n),
  'numbered from one'
);
select is(
  (select count(*)::integer from exercise_assignment
   where group_id = (select id from copies where ordinality = 1)),
  (select count(*)::integer from exercise_assignment
   where group_id = '20000000-0000-4000-8000-000000000001'),
  'and their exercises'
);
select results_eq(
  $$ select b.title, a.position, a.is_hidden from exercise_assignment a
     join class_block b on b.id = a.block_id
     where a.group_id = (select id from copies where ordinality = 1) and b.title = 'Recuperación del tema 2'
     order by a.position $$,
  $$ select b.title, a.position, a.is_hidden from exercise_assignment a
     join class_block b on b.id = a.block_id
     where b.id = 'a0000000-0000-4000-8000-000000000005' order by a.position $$,
  'each in its place and with its visibility'
);
select is(
  (select is_hidden from class_block
   where group_id = (select id from copies where ordinality = 1) and title = 'Repaso final'),
  true,
  'a hidden block stays hidden'
);
select is(
  (select to_char(min(a.due_at) at time zone 'Europe/Madrid', 'Dy DD/MM/YYYY HH24:MI')
   from exercise_assignment a join class_block b on b.id = a.block_id
   where a.group_id = (select id from copies where ordinality = 1) and b.title = 'Tema 4: Cadenas y formato'),
  'Fri 05/11/2027 23:59',
  'a due date is the same weekday and time a year later (Fri 06/11/2026 23:59)'
);
select is(
  (select to_char(opens_at at time zone 'Europe/Madrid', 'Dy DD/MM/YYYY HH24:MI') from class_block
   where group_id = (select id from copies where ordinality = 1) and title = 'Examen de los temas 5 y 6'),
  'Mon 22/11/2027 09:00',
  'and so is an opening date (Mon 23/11/2026 09:00)'
);
select is(
  (select count(*)::integer from enrollment where group_id = (select id from copies where ordinality = 1)),
  (select count(*)::integer from enrollment where group_id = '20000000-0000-4000-8000-000000000001') - 1,
  'with its students but the disabled ones'
);
select is_empty(
  $$ select 1 from enrollment where user_id = '10000000-0000-4000-8000-000000000050'
     and group_id in (select id from copies) $$,
  'Raúl is not enrolled in the copy'
);
select is(
  (select count(*)::integer from attempt t join exercise_assignment a on a.id = t.assignment_id
   where a.group_id in (select id from copies)),
  0,
  'and nobody has started anything in it'
);

create temp table parallel as
select * from duplicate_groups(
  array['20000000-0000-4000-8000-000000000001']::uuid[], '1.º DAW B', '2026/27',
  '10000000-0000-4000-8000-000000000002', true, false, false);

select results_eq(
  $$ select count(*)::integer, count(b.opens_at)::integer from class_block b
     where b.group_id = (select id from parallel) $$,
  $$ values (9, 0) $$,
  'a parallel group without dates'
);
select is(
  (select count(*)::integer from class_group g
   where g.name = '1.º DAW B' and exists (select 1 from enrollment e where e.group_id = g.id)),
  0,
  'nor students'
);
select is(
  (select count(*)::integer from exercise_assignment a join class_group g on g.id = a.group_id
   where g.name = '1.º DAW B' and a.due_at is not null),
  0,
  'nor due dates'
);

select throws_ok(
  $$ select duplicate_groups(array['20000000-0000-4000-8000-000000000002']::uuid[], 'Copia',
       '2027/28', '10000000-0000-4000-8000-000000000002', true, true, true) $$,
  'P0002', null,
  'not a group of another teacher'
);
select throws_ok(
  $$ select duplicate_groups(array['20000000-0000-4000-8000-000000000001']::uuid[], 'Copia',
       '2027/28', '10000000-0000-4000-8000-000000000003', false, false, false) $$,
  '42501', null,
  'nor for another teacher'
);
select throws_ok(
  $$ select duplicate_groups(array['20000000-0000-4000-8000-000000000001']::uuid[], 'Copia',
       '2027', '10000000-0000-4000-8000-000000000002', false, false, false) $$,
  '23514', null,
  'the year is like 2026/27'
);
select throws_ok(
  $$ select duplicate_groups(array['20000000-0000-4000-8000-000000000001',
       '20000000-0000-4000-8000-000000000001']::uuid[], 'Copia', '2027/28',
       '10000000-0000-4000-8000-000000000002', false, false, false) $$,
  '22023', null,
  'each group once'
);

-- Copying blocks into a group of the class without them
select is(
  copy_blocks('20000000-0000-4000-8000-000000000003', (select id from copies where ordinality = 1),
    false, 'Europe/Madrid'),
  (select count(*)::integer from class_block where group_id = '20000000-0000-4000-8000-000000000003'),
  'a teacher copies the blocks of a group into another'
);
select is(
  (select array_agg(position order by position) from class_block
   where group_id = (select id from copies where ordinality = 1) and position > 9),
  (select array_agg(9 + n::integer) from generate_series(1,
    (select count(*)::integer from class_block where group_id = '20000000-0000-4000-8000-000000000003')) n),
  'after those it already had'
);
select throws_ok(
  $$ select copy_blocks('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', true) $$,
  'P0002', null,
  'not from a group of another teacher'
);
select throws_ok(
  $$ select copy_blocks('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', true) $$,
  '22023', null,
  'nor into the same group'
);

-- Enrolling in the whole class: Elena (...041) is in no copy, Lucía (...011) in both
select throws_ok(
  $$ select enroll_students((select id from copies where ordinality = 1),
       array['10000000-0000-4000-8000-000000000011']::uuid[],
       array[(select id from copies where ordinality = 2)]) $$,
  '23505', null,
  'a student already in the group stops the batch, as before'
);
select is(
  (select array_agg(name) from enroll_students((select id from copies where ordinality = 1),
    array['10000000-0000-4000-8000-000000000041']::uuid[],
    array[(select id from copies where ordinality = 2)])),
  array['Elena Vázquez Lorenzo'],
  'a teacher enrolls a student in several groups of the class at once, and reads the first'
);
select ok(
  exists (select 1 from enrollment where user_id = '10000000-0000-4000-8000-000000000041'
    and group_id = (select id from copies where ordinality = 2)),
  'who is in the other group too'
);
select lives_ok(
  $$ select enroll_students(
       (select id from class_group where name = '1.º DAW B' limit 1),
       array['10000000-0000-4000-8000-000000000041']::uuid[],
       array[(select id from copies where ordinality = 2)]) $$,
  'in the other groups, who is already there is skipped'
);
select throws_ok(
  $$ select enroll_students((select id from copies where ordinality = 1),
       array['10000000-0000-4000-8000-000000000012']::uuid[],
       array['20000000-0000-4000-8000-000000000002']::uuid[]) $$,
  'P0002', null,
  'not in a group of another teacher'
);

-- The administrator duplicates for any teacher
select pg_temp.sign_in('10000000-0000-4000-8000-000000000001');
select results_eq(
  $$ select teacher_id::text from duplicate_groups(array['20000000-0000-4000-8000-000000000002']::uuid[],
       '1.º DAM B', '2027/28', '10000000-0000-4000-8000-000000000003', true, true, false) $$,
  $$ values ('10000000-0000-4000-8000-000000000003') $$,
  'the administrator duplicates any group, for the teacher they choose'
);

select * from finish();
rollback;
