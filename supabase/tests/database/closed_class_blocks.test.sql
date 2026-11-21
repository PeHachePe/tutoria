-- Step 5.2f · The blocks of a closed class, read only (docs/PLAN.md §2.3, D-083).
-- Seed: 1.º DAW A of this year (group ...001) is Marta's (...002). The test adds 2.º DAW Z of
-- 2020/21, always a past year: by Marta, with her group in subject ...001, two blocks and three
-- assignments of exercises ...001 to ...003. The administrator is ...001.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

create function pg_temp.sign_in(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
end;
$$;

-- How many rows a statement changed: a write the RLS stops changes none, without an error.
create function pg_temp.changed_rows(statement text) returns bigint language plpgsql as $$
declare
  changed bigint;
begin
  execute statement;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

insert into school_class (id, name, school_year, created_by) values
  ('c0000000-0000-4000-8000-0000000000f1', '2.º DAW Z', '2020/21', '10000000-0000-4000-8000-000000000002');
insert into class_group (id, class_id, subject_id, teacher_id) values
  ('20000000-0000-4000-8000-0000000000f1', 'c0000000-0000-4000-8000-0000000000f1',
   'b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002');
insert into class_block (id, group_id, position, title, source_locale, translations, is_hidden) values
  ('a0000000-0000-4000-8000-0000000000f1', '20000000-0000-4000-8000-0000000000f1', 1, 'Tema 1', 'es', '{}', false),
  ('a0000000-0000-4000-8000-0000000000f2', '20000000-0000-4000-8000-0000000000f1', 2, 'Tema 2', 'es', '{}', false);
insert into exercise_assignment (id, group_id, block_id, exercise_id, position) values
  ('60000000-0000-4000-8000-0000000000f1', '20000000-0000-4000-8000-0000000000f1',
   'a0000000-0000-4000-8000-0000000000f1', '40000000-0000-4000-8000-000000000001', 1),
  ('60000000-0000-4000-8000-0000000000f2', '20000000-0000-4000-8000-0000000000f1',
   'a0000000-0000-4000-8000-0000000000f1', '40000000-0000-4000-8000-000000000002', 2),
  ('60000000-0000-4000-8000-0000000000f3', '20000000-0000-4000-8000-0000000000f1',
   'a0000000-0000-4000-8000-0000000000f2', '40000000-0000-4000-8000-000000000003', 1);

-- Marta, in her group of a past year ------------------------------------------------------------------
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');

select is(
  (select count(*) from class_block where group_id = '20000000-0000-4000-8000-0000000000f1'),
  2::bigint,
  'the blocks of a closed class are still read'
);
select throws_ok(
  $$ select create_block('20000000-0000-4000-8000-0000000000f1', 'Examen', 'es', '{}', false, null) $$,
  '42501', null,
  'nobody adds a block to it'
);
select is(
  pg_temp.changed_rows($$ update class_block set title = 'Otro'
    where id = 'a0000000-0000-4000-8000-0000000000f1' $$),
  0::bigint,
  'nor changes one'
);
select is(
  pg_temp.changed_rows($$ delete from class_block
    where id = 'a0000000-0000-4000-8000-0000000000f2' $$),
  0::bigint,
  'nor deletes one nobody started'
);
select throws_ok(
  $$ select reorder_blocks('20000000-0000-4000-8000-0000000000f1',
       array['a0000000-0000-4000-8000-0000000000f2', 'a0000000-0000-4000-8000-0000000000f1']::uuid[]) $$,
  '42501', null,
  'nor reorders them'
);
select throws_ok(
  $$ select assign_exercises('a0000000-0000-4000-8000-0000000000f2',
       array['40000000-0000-4000-8000-000000000004']::uuid[]) $$,
  '42501', null,
  'nobody assigns an exercise in it'
);
select is(
  pg_temp.changed_rows($$ update exercise_assignment set is_hidden = true
    where id = '60000000-0000-4000-8000-0000000000f1' $$),
  0::bigint,
  'nor hides one'
);
select is(
  pg_temp.changed_rows($$ delete from exercise_assignment
    where id = '60000000-0000-4000-8000-0000000000f2' $$),
  0::bigint,
  'nor takes one out'
);
select throws_ok(
  $$ select reorder_assignments('a0000000-0000-4000-8000-0000000000f1',
       array['60000000-0000-4000-8000-0000000000f2', '60000000-0000-4000-8000-0000000000f1']::uuid[]) $$,
  '42501', null,
  'nor reorders them'
);
select throws_ok(
  $$ select move_assignment('60000000-0000-4000-8000-0000000000f1',
       'a0000000-0000-4000-8000-0000000000f2', 1) $$,
  '42501', null,
  'nor moves one to another block'
);
select throws_ok(
  $$ select copy_blocks('20000000-0000-4000-8000-000000000001',
       '20000000-0000-4000-8000-0000000000f1', true) $$,
  '42501', null,
  'nothing is copied into it'
);
select is(
  copy_blocks('20000000-0000-4000-8000-0000000000f1', '20000000-0000-4000-8000-000000000001', true),
  2,
  'but its blocks are copied into a group of this year'
);

-- The administration ---------------------------------------------------------------------------------
select pg_temp.sign_in('10000000-0000-4000-8000-000000000001');

select throws_ok(
  $$ select create_block('20000000-0000-4000-8000-0000000000f1', 'Examen', 'es', '{}', false, null) $$,
  '42501', null,
  'the administration does not add a block to it either'
);
select reopen_class('c0000000-0000-4000-8000-0000000000f1', true);

select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');
select is(
  (select position from create_block('20000000-0000-4000-8000-0000000000f1', 'Examen', 'es', '{}', false, null)),
  3,
  'once reopened, its teacher adds blocks'
);
select is(
  pg_temp.changed_rows($$ delete from class_block
    where id = 'a0000000-0000-4000-8000-0000000000f2' $$),
  1::bigint,
  'and deletes those nobody started'
);
select is(
  pg_temp.changed_rows($$ delete from class_block
    where id in ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006') $$),
  1::bigint,
  'several at once: what somebody started stays (removeBlocks)'
);

select * from finish();
rollback;
