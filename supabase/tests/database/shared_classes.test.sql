-- Step 5.2d · The class, shared by the teachers of the school (docs/PLAN.md §2.3, D-081).
-- Seed: 1.º DAW A 2026/27 (class c...001, created by Marta ...002) has Marta's groups ...001
-- (subject ...001, 9 blocks, started) and ...003 (subject ...003) and Javier's split «Desdoble
-- inglés» ...005 (subject ...001, nobody in it); its 24 students are Lucía (...011) and the rest.
-- 1.º DAM B (c...002, by Javier ...003) has groups ...002 and ...004, with Elena (...041). Raúl
-- (...050) is a disabled student and the administrator is ...001.
begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

create function pg_temp.sign_in(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
end;
$$;

create function pg_temp.changed_rows(statement text) returns bigint language plpgsql as $$
declare
  changed bigint;
begin
  execute statement;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

-- Raúl was in the class before his account was disabled: he stays in it, but is not copied.
update app_user set status = 'active' where id = '10000000-0000-4000-8000-000000000050';
insert into enrollment (group_id, user_id) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000050');
insert into class_member (class_id, user_id) values
  ('c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000050');
update app_user set status = 'disabled' where id = '10000000-0000-4000-8000-000000000050';

-- A student ----------------------------------------------------------------------------------------
select pg_temp.sign_in('10000000-0000-4000-8000-000000000011');

select results_eq(
  $$ select name from school_class $$,
  $$ values ('1.º DAW A') $$,
  'a student reads the classes of their groups'
);
select results_eq(
  $$ select class_id::text from class_member $$,
  $$ values ('c0000000-0000-4000-8000-000000000001') $$,
  'and only their own place in them'
);
select is_empty($$ select * from managed_classes() $$, 'and looks after none');

-- Marta --------------------------------------------------------------------------------------------
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');

select is((select count(*)::integer from school_class), 2, 'a teacher reads every class, to join one');
select results_eq(
  $$ select id::text from managed_classes() $$,
  $$ values ('c0000000-0000-4000-8000-000000000001') $$,
  'and looks after those where she teaches'
);
select is(
  (select count(*)::integer from class_roster('c0000000-0000-4000-8000-000000000001')),
  25,
  'she reads the students of her class, the disabled one too'
);
select results_eq(
  $$ select is_active, is_member, group_ids from class_roster('c0000000-0000-4000-8000-000000000001')
     where id = '10000000-0000-4000-8000-000000000011' $$,
  $$ values (true, true, array['20000000-0000-4000-8000-000000000001',
                                '20000000-0000-4000-8000-000000000003']::uuid[]) $$,
  'with the groups of the class each one is in'
);
select throws_ok(
  $$ select * from class_roster('c0000000-0000-4000-8000-000000000002') $$,
  'P0002', null,
  'not those of a class where she does not teach'
);

-- Creating a class and joining one
create temp table daw_b as
select create_class(' 1.º DAW B ', '2026/27', array[
  'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003']::uuid[],
  '10000000-0000-4000-8000-000000000002') as id;

select results_eq(
  $$ select c.name, c.created_by::text, count(g.id)::integer from school_class c
     join class_group g on g.class_id = c.id where c.id = (select id from daw_b)
     group by c.name, c.created_by $$,
  $$ values ('1.º DAW B', '10000000-0000-4000-8000-000000000002', 2) $$,
  'a teacher creates a class with a group of hers in each subject'
);
select is(
  create_class('1.º daw b', '2026/27', '{}', null),
  (select id from daw_b),
  'the same name, whatever its capitals, is the same class'
);
select throws_ok(
  $$ select create_class('1.º DAW B', '2026/27', array['b0000000-0000-4000-8000-000000000001']::uuid[],
       '10000000-0000-4000-8000-000000000002') $$,
  '23505', null,
  'which has each subject once, without a label'
);
select throws_ok(
  $$ select create_class('1.º DAW C', '2026/27', array['b0000000-0000-4000-8000-000000000001']::uuid[],
       '10000000-0000-4000-8000-000000000003') $$,
  '42501', null,
  'a teacher does not create groups for another'
);
select throws_ok(
  $$ select create_class('1.º DAW C', '2026', '{}', null) $$,
  '23514', null,
  'the year is like 2026/27'
);
select throws_ok(
  $$ select create_class('  ', '2026/27', '{}', null) $$,
  '23514', null,
  'and the name is not blank'
);

-- A subject of the whole class takes its active students; a split, nobody
create temp table advanced as
select add_class_group('c0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000002', null, '10000000-0000-4000-8000-000000000002') as id;

select is(
  (select count(*)::integer from enrollment where group_id = (select id from advanced)),
  24,
  'a new group of the whole class takes its active students'
);
select throws_ok(
  $$ select add_class_group('c0000000-0000-4000-8000-000000000001',
       'b0000000-0000-4000-8000-000000000001', '', '10000000-0000-4000-8000-000000000002') $$,
  '23505', null,
  'a second group of a subject needs a label'
);
select is(
  (select count(*)::integer from enrollment where group_id = (select add_class_group(
    'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
    ' Desdoble alemán ', '10000000-0000-4000-8000-000000000002'))),
  0,
  'with one it is a split, whose students are chosen'
);
select throws_ok(
  $$ select add_class_group('c0000000-0000-4000-8000-000000000001',
       'b0000000-0000-4000-8000-000000000003', repeat('x', 31), '10000000-0000-4000-8000-000000000002') $$,
  '23514', null,
  'a label has 30 characters at most'
);
select throws_ok(
  $$ select add_class_group('c0000000-0000-4000-8000-000000000099',
       'b0000000-0000-4000-8000-000000000003', null, '10000000-0000-4000-8000-000000000002') $$,
  'P0002', null,
  'nor in a class that does not exist'
);

-- The students of the class
select results_eq(
  $$ select name from search_class_students('vázq', 'c0000000-0000-4000-8000-000000000001') $$,
  $$ values ('Elena Vázquez Lorenzo') $$,
  'a teacher finds students of the whole school'
);
select is_empty(
  $$ select * from search_class_students('lucía', 'c0000000-0000-4000-8000-000000000001') $$,
  'but not those already in the class'
);
select lives_ok(
  $$ select enroll_class_members('c0000000-0000-4000-8000-000000000001',
       array['10000000-0000-4000-8000-000000000041']::uuid[]) $$,
  'a teacher enrolls a student in her class'
);
select results_eq(
  $$ select array_agg(e.group_id order by e.group_id) from enrollment e
     join class_group g on g.id = e.group_id
     where g.class_id = 'c0000000-0000-4000-8000-000000000001'
       and e.user_id = '10000000-0000-4000-8000-000000000041' $$,
  $$ select array_agg(id order by id) from class_group
     where class_id = 'c0000000-0000-4000-8000-000000000001' and label is null $$,
  'who joins every group of the whole class, those of other teachers too, and no split'
);
select throws_ok(
  $$ select enroll_class_members('c0000000-0000-4000-8000-000000000001',
       array['10000000-0000-4000-8000-000000000050']::uuid[]) $$,
  '23514', null,
  'not a disabled student'
);
select throws_ok(
  $$ select enroll_class_members('c0000000-0000-4000-8000-000000000002',
       array['10000000-0000-4000-8000-000000000012']::uuid[]) $$,
  'P0002', null,
  'nor in a class where she does not teach'
);
select lives_ok(
  $$ select remove_class_member('c0000000-0000-4000-8000-000000000001',
       '10000000-0000-4000-8000-000000000041') $$,
  'a teacher takes a student out of her class'
);
select is_empty(
  $$ select * from class_roster('c0000000-0000-4000-8000-000000000001')
     where id = '10000000-0000-4000-8000-000000000041' $$,
  'and out of all its groups'
);
select throws_ok(
  $$ select remove_class_member('c0000000-0000-4000-8000-000000000001',
       '10000000-0000-4000-8000-000000000041') $$,
  'P0002', null,
  'who is no longer there'
);

-- Renaming and deleting
select is(
  pg_temp.changed_rows($$ update school_class set name = '1.º DAW A (mañana)'
    where id = 'c0000000-0000-4000-8000-000000000001' $$),
  1::bigint,
  'its creator renames a class'
);
select is(
  pg_temp.changed_rows($$ delete from school_class where id = 'c0000000-0000-4000-8000-000000000001' $$),
  0::bigint,
  'but deletes it only empty'
);
create temp table empty_class as select create_class('Vacía', '2026/27', '{}', null) as id;
select is(
  pg_temp.changed_rows($$ delete from school_class where id = (select id from empty_class) $$),
  1::bigint,
  'as one without groups'
);

-- Duplicating her groups for the next year
create temp table next_year as
select duplicate_class('c0000000-0000-4000-8000-000000000001', '1.º DAW A', '2027/28',
  array['20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001']::uuid[],
  true, true, true, 'Europe/Madrid') as id;

select results_eq(
  $$ select g.subject_id::text, g.teacher_id::text from class_group g
     where g.class_id = (select id from next_year) order by g.subject_id desc $$,
  $$ values ('b0000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002'),
            ('b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002') $$,
  'a teacher duplicates the groups she chose into a new class'
);
select is(
  (select count(*)::integer from class_block b join class_group g on g.id = b.group_id
   where g.class_id = (select id from next_year)
     and g.subject_id = 'b0000000-0000-4000-8000-000000000001'),
  9,
  'with their blocks'
);
select is(
  (select to_char(min(a.due_at) at time zone 'Europe/Madrid', 'Dy DD/MM/YYYY HH24:MI')
   from exercise_assignment a join class_block b on b.id = a.block_id
   join class_group g on g.id = a.group_id
   where g.class_id = (select id from next_year) and b.title = 'Tema 4: Cadenas y formato'),
  'Fri 05/11/2027 23:59',
  'and their dates, the same weekday and time a year later (Fri 06/11/2026 23:59)'
);
select is(
  (select count(*)::integer from class_member where class_id = (select id from next_year)),
  24,
  'with the active students of the class'
);
select is(
  (select count(*)::integer from enrollment e join class_group g on g.id = e.group_id
   where g.class_id = (select id from next_year)
     and g.subject_id = 'b0000000-0000-4000-8000-000000000001'),
  24,
  'and of each group, without the disabled one'
);
select is(
  (select count(*)::integer from attempt t join exercise_assignment a on a.id = t.assignment_id
   join class_group g on g.id = a.group_id where g.class_id = (select id from next_year)),
  0,
  'and nobody has started anything in it'
);
create temp table parallel as
select duplicate_class('c0000000-0000-4000-8000-000000000001', '1.º DAW C', '2026/27',
  array['20000000-0000-4000-8000-000000000001']::uuid[], true, false, false) as id;
select results_eq(
  $$ select count(b.id)::integer, count(b.opens_at)::integer,
       (select count(*)::integer from enrollment e join class_group g on g.id = e.group_id
        where g.class_id = (select id from parallel))
     from class_block b join class_group g on g.id = b.group_id
     where g.class_id = (select id from parallel) $$,
  $$ values (9, 0, 0) $$,
  'a parallel class, without dates nor students'
);
select throws_ok(
  $$ select duplicate_class('c0000000-0000-4000-8000-000000000001', '1.º DAW D', '2027/28',
       array['20000000-0000-4000-8000-000000000005']::uuid[], false, false, false) $$,
  'P0002', null,
  'not with the group of another teacher'
);
select throws_ok(
  $$ select duplicate_class('c0000000-0000-4000-8000-000000000001', '1.º daw a (mañana)', '2026/27',
       array['20000000-0000-4000-8000-000000000001']::uuid[], false, false, false) $$,
  '22023', null,
  'nor into the same class'
);

-- Javier -------------------------------------------------------------------------------------------
select pg_temp.sign_in('10000000-0000-4000-8000-000000000003');

select is(
  (select count(*)::integer from class_roster('c0000000-0000-4000-8000-000000000001')),
  25,
  'a teacher with a split of the class reads its students too (name and email)'
);
select is(
  pg_temp.changed_rows($$ update school_class set name = 'Otra'
    where id = 'c0000000-0000-4000-8000-000000000001' $$),
  0::bigint,
  'but only its creator renames it'
);

-- The administrator --------------------------------------------------------------------------------
select pg_temp.sign_in('10000000-0000-4000-8000-000000000001');

create temp table later as
select duplicate_class('c0000000-0000-4000-8000-000000000001', '1.º DAW A', '2028/29',
  array['20000000-0000-4000-8000-000000000005']::uuid[], false, false, false) as id;
select results_eq(
  $$ select g.teacher_id::text, g.label from class_group g where g.class_id = (select id from later) $$,
  $$ values ('10000000-0000-4000-8000-000000000003', 'Desdoble inglés') $$,
  'the administrator duplicates any group, which keeps its teacher and label'
);

select * from finish();
rollback;
