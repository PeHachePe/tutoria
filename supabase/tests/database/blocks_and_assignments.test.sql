-- Step 4.3b · Blocks and assignments of a group (docs/PLAN.md §2.3, D-058).
-- Seed: Marta (...002) teaches 1.º DAW A (group ...001), with nine blocks: «Tema 1» (...001, with
-- attempts), «Tema 5» (...013) and «Repaso final» (...006, hidden), nobody has started the last two.
-- Javier (...003) teaches 1.º DAM B (group ...002). Lucía (...011) is a student of 1.º DAW A.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

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
  (select position from create_block('20000000-0000-4000-8000-000000000001', 'Examen', 'es', '{}', true, null)),
  10,
  'a new block goes after the others of the group'
);
select is(
  (select array_agg(position order by position) from assign_exercises(
    'a0000000-0000-4000-8000-000000000006',
    array['40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002']::uuid[])),
  array[3, 4],
  'the exercises assigned go after those of the block, in the order given'
);
select throws_ok(
  $$ select assign_exercises('a0000000-0000-4000-8000-000000000006',
       array['40000000-0000-4000-8000-000000000005']::uuid[]) $$,
  '23505', null,
  'an exercise is only once in a block'
);
select lives_ok(
  $$ select reorder_blocks('20000000-0000-4000-8000-000000000001', array(
       select id from class_block where group_id = '20000000-0000-4000-8000-000000000001'
       order by position desc)) $$,
  'a teacher reorders the blocks of their group'
);
select is(
  (select title from class_block where group_id = '20000000-0000-4000-8000-000000000001' and position = 1),
  'Examen',
  'in the new order'
);
select throws_ok(
  $$ select reorder_blocks('20000000-0000-4000-8000-000000000001',
       array['a0000000-0000-4000-8000-000000000001']::uuid[]) $$,
  '22023', null,
  'the new order has every block of the group'
);
select lives_ok(
  $$ select reorder_assignments('a0000000-0000-4000-8000-000000000004', array[
       '60000000-0000-4000-8000-000000000008', '60000000-0000-4000-8000-000000000006',
       '60000000-0000-4000-8000-000000000007']::uuid[]) $$,
  'a teacher reorders the exercises of a block'
);
select is(
  (select array_agg(exercise_id order by position)
   from exercise_assignment where block_id = 'a0000000-0000-4000-8000-000000000004'),
  array['40000000-0000-4000-8000-000000000008', '40000000-0000-4000-8000-000000000006',
        '40000000-0000-4000-8000-000000000007']::uuid[],
  'in the new order'
);
select throws_ok(
  $$ select reorder_assignments('a0000000-0000-4000-8000-000000000004', array[
       '60000000-0000-4000-8000-000000000006', '60000000-0000-4000-8000-000000000006',
       '60000000-0000-4000-8000-000000000007']::uuid[]) $$,
  '22023', null,
  'nor an assignment twice'
);
select lives_ok(
  $$ update exercise_assignment set due_at = '2026-12-01T22:59:00Z'
     where id = '60000000-0000-4000-8000-000000000011' $$,
  'a teacher gives an assignment a due date'
);
select is(
  (select student_count from assignment_student_counts('20000000-0000-4000-8000-000000000001')
   where assignment_id = '60000000-0000-4000-8000-000000000001'),
  24,
  'a teacher counts the students who started each assignment'
);

-- Deleting only what nobody started
select is(
  pg_temp.changed_rows($$ delete from exercise_assignment where id = '60000000-0000-4000-8000-000000000001' $$),
  0::bigint,
  'an assignment somebody started is not deleted'
);
select is(
  pg_temp.changed_rows($$ delete from exercise_assignment where id = '60000000-0000-4000-8000-000000000011' $$),
  1::bigint,
  'one nobody started is'
);
select is(
  pg_temp.changed_rows($$ delete from class_block where id = 'a0000000-0000-4000-8000-000000000001' $$),
  0::bigint,
  'a block somebody started is not deleted'
);
select is(
  pg_temp.changed_rows($$ delete from class_block where id = 'a0000000-0000-4000-8000-000000000006' $$),
  1::bigint,
  'one nobody started is'
);
select is(
  (select count(*) from exercise_assignment where block_id = 'a0000000-0000-4000-8000-000000000006'),
  0::bigint,
  'with its assignments'
);

-- Javier, with the blocks of a group of Marta
reset role;
select pg_temp.sign_in('10000000-0000-4000-8000-000000000003');

select throws_ok(
  $$ select create_block('20000000-0000-4000-8000-000000000001', 'Examen', 'es', '{}', false, null) $$,
  '42501', null,
  'a teacher cannot add blocks to the groups of another'
);
select throws_ok(
  $$ select reorder_assignments('a0000000-0000-4000-8000-000000000013', array[
       '60000000-0000-4000-8000-000000000012', '60000000-0000-4000-8000-000000000014',
       '60000000-0000-4000-8000-000000000017']::uuid[]) $$,
  '22023', null,
  'nor reorder them: the blocks of another are not theirs to count'
);

select * from finish();
rollback;
