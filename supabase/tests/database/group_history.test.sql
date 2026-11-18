-- Step 4.5 · The history of a group (docs/PLAN.md §2.1, ficha 09, D-073): `group_work_stats` and
-- `group_deadline_stats` count as `groupHistoryOf()` of the mock data, with the figures of its test.
-- Seed: Marta (...002) teaches 1.º DAW A (group ...001), with 24 students and nine blocks: «Tema 1» to
-- «Tema 4» (...001 to ...004) and «Recuperación del tema 2» (...005) with attempts, «Repaso final»
-- (...006) hidden and without any. Javier (...003) teaches another group, Lucía (...011) is a student
-- of 1.º DAW A and the administration is ...001.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

create function pg_temp.sign_in(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
end;
$$;

select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');

select results_eq(
  $$ select s.id from group_work_stats('20000000-0000-4000-8000-000000000001') s where s.is_block $$,
  $$ select b.id from class_block b where b.group_id = '20000000-0000-4000-8000-000000000001'
     order by b.position $$,
  'a row per block of the group, in order, also those nobody started'
);
select is(
  (select array_agg(distinct s.students) from group_work_stats('20000000-0000-4000-8000-000000000001') s),
  array[24],
  'with the students enrolled now'
);
select results_eq(
  $$ select s.attempts, s.active_students, s.hints, s.solved, s.median_seconds, s.stuck_students
     from group_work_stats('20000000-0000-4000-8000-000000000001') s
     where s.is_block and s.attempts > 0 $$,
  $$ values (48, 24, 54, 48, 720, 6), (48, 24, 27, 46, 540, 1), (23, 23, 8, 20, 540, 0),
            (59, 24, 0, 41, 360, 0), (1, 1, 1, 0, 0, 0) $$,
  'the blocks started count as the mock data, with 0 as the median of a block without submissions'
);
select results_eq(
  $$ select s.assignments, s.attempts, s.hints, s.solved, s.stuck_students
     from group_work_stats('20000000-0000-4000-8000-000000000001') s
     where s.id = 'a0000000-0000-4000-8000-000000000006' $$,
  $$ values (2, 0, 0, 0, 0) $$,
  'the final review, hidden and without attempts, has its 2 assignments and everything at zero'
);
select results_eq(
  $$ select s.attempts, s.solved, s.median_seconds
     from group_work_stats('20000000-0000-4000-8000-000000000001') s
     where s.block_id = 'a0000000-0000-4000-8000-000000000004' and not s.is_block $$,
  $$ values (21, 14, 360), (19, 13, 360), (19, 14, 360) $$,
  'each exercise of «Tema 4» has its figures, after its block and in its order'
);

-- Practice does not count: two hints in Lucía's second attempt at the first exercise.
reset role;
insert into process_event (attempt_id, type, detail) values
  ('70000000-0000-4000-8000-000000000203', 'hint_requested', '{}'),
  ('70000000-0000-4000-8000-000000000203', 'hint_requested', '{}');
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');
select is(
  (select s.hints from group_work_stats('20000000-0000-4000-8000-000000000001') s
   where s.id = 'a0000000-0000-4000-8000-000000000001'),
  54,
  'the hints of a practice attempt do not count'
);

-- A hidden assignment of «Tema 5» (...013) counts only once somebody works on it.
reset role;
update exercise_assignment set is_hidden = true where id = '60000000-0000-4000-8000-000000000011';
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');
select results_eq(
  $$ select s.assignments,
       exists (select 1 from group_work_stats('20000000-0000-4000-8000-000000000001') x
               where x.id = '60000000-0000-4000-8000-000000000011')
     from group_work_stats('20000000-0000-4000-8000-000000000001') s
     where s.id = 'a0000000-0000-4000-8000-000000000013' $$,
  $$ values (3, false) $$,
  'a hidden assignment without attempts does not count'
);
reset role;
insert into attempt (exercise_id, user_id, assignment_id)
select a.exercise_id, '10000000-0000-4000-8000-000000000011', a.id
from exercise_assignment a where a.id = '60000000-0000-4000-8000-000000000011';
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');
select results_eq(
  $$ select s.assignments, s.attempts
     from group_work_stats('20000000-0000-4000-8000-000000000001') s
     where s.id = 'a0000000-0000-4000-8000-000000000013' $$,
  $$ values (4, 1) $$,
  'and, once somebody works on it, it does'
);

-- The due dates
select results_eq(
  $$ select d.due_at, d.assignments, d.on_time, d.last_hours, d.late, cardinality(d.missing_ids),
       cardinality(d.missing_names), cardinality(d.missing_pending)
     from group_deadline_stats('20000000-0000-4000-8000-000000000001') d
     where d.block_id = 'a0000000-0000-4000-8000-000000000004' $$,
  $$ values ('2026-11-06 22:59:00+00'::timestamptz, 3, 40, 0, 0, 19, 19, 19) $$,
  'the due date of «Tema 4» has its submissions and 19 students with something pending'
);
select results_eq(
  $$ select d.missing_names[1:3], d.missing_pending[1:3]
     from group_deadline_stats('20000000-0000-4000-8000-000000000001') d
     where d.block_id = 'a0000000-0000-4000-8000-000000000004' $$,
  $$ values (array['Adrián López Vidal', 'Álex Ruiz Moreno', 'Carmen Navarro Gil'], array[2, 2, 1]) $$,
  'by name, each with how many are pending'
);

-- Lucía submits one exercise of «Tema 4» an hour before the date and another an hour after it.
reset role;
update attempt set finished_at = '2026-11-06 21:59:00+00' where id = '70000000-0000-4000-8000-000000000006';
update attempt set finished_at = '2026-11-06 23:59:00+00' where id = '70000000-0000-4000-8000-000000000007';
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');
select results_eq(
  $$ select d.on_time, d.last_hours, d.late
     from group_deadline_stats('20000000-0000-4000-8000-000000000001') d
     where d.block_id = 'a0000000-0000-4000-8000-000000000004' $$,
  $$ values (39, 1, 1) $$,
  'a submission in the last hours is on time and counts apart; one after the date is late'
);
reset role;
update class_block set is_hidden = true where id = 'a0000000-0000-4000-8000-000000000004';
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');
select is_empty(
  $$ select 1 from group_deadline_stats('20000000-0000-4000-8000-000000000001') d
     where d.block_id = 'a0000000-0000-4000-8000-000000000004' $$,
  'the due date of a hidden block goes'
);

-- Lucía leaves the group.
reset role;
delete from enrollment
where user_id = '10000000-0000-4000-8000-000000000011' and group_id = '20000000-0000-4000-8000-000000000001';
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');
select results_eq(
  $$ select s.students, s.attempts from group_work_stats('20000000-0000-4000-8000-000000000001') s
     where s.id = 'a0000000-0000-4000-8000-000000000001' $$,
  $$ values (23, 46) $$,
  'a student who leaves the group stops counting, and so do their attempts'
);

-- Who reads them
select pg_temp.sign_in('10000000-0000-4000-8000-000000000003');
select throws_ok(
  $$ select group_work_stats('20000000-0000-4000-8000-000000000001') $$,
  'P0002', null,
  'another teacher does not read the work of the group'
);
select throws_ok(
  $$ select group_deadline_stats('20000000-0000-4000-8000-000000000001') $$,
  'P0002', null,
  'nor its due dates'
);
select pg_temp.sign_in('10000000-0000-4000-8000-000000000011');
select throws_ok(
  $$ select group_work_stats('20000000-0000-4000-8000-000000000001') $$,
  'P0002', null,
  'a student does not read the work of a group'
);
select throws_ok(
  $$ select group_deadline_stats('20000000-0000-4000-8000-000000000001') $$,
  'P0002', null,
  'nor its due dates'
);
select pg_temp.sign_in('10000000-0000-4000-8000-000000000001');
select isnt_empty(
  $$ select 1 from group_work_stats('20000000-0000-4000-8000-000000000001') $$,
  'the administration reads the work of any group'
);
select isnt_empty(
  $$ select 1 from group_deadline_stats('20000000-0000-4000-8000-000000000001') $$,
  'and its due dates'
);
reset role;
set local role anon;
select throws_ok(
  $$ select group_work_stats('20000000-0000-4000-8000-000000000001') $$,
  '42501', null,
  'without signing in, nobody runs them'
);
select throws_ok(
  $$ select group_deadline_stats('20000000-0000-4000-8000-000000000001') $$,
  '42501', null,
  'neither of them'
);
reset role;

select * from finish();
rollback;
