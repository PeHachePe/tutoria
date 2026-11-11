-- Steps 2.1 and 2.5c · Transitions of an attempt (docs/PLAN.md §2.4): only the server writes the
-- status. Attempts are opened from an assignment, and a submitted one can be practised again.
-- Seed: Lucía (...011) has exercise 8 passed (attempt ...008); Hugo (...012) has exercise 4 with
-- tests failed (...012), exercise 6 in progress (...014) and no attempt at exercise 7; Elena
-- (...041) is in 1.º DAM B, without exercise 5; Marta (...002) teaches 1.º DAW A and Javier
-- (...003), 1.º DAM B. Assignments ...001 to ...008 are exercises 1 to 8 in 1.º DAW A.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

create function pg_temp.sign_in(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
end;
$$;

-- Submitting (Lucía)
select pg_temp.sign_in('10000000-0000-4000-8000-000000000011');

select is(
  (select status::text from submit_attempt('70000000-0000-4000-8000-000000000008')),
  'submitted',
  'submit_attempt submits a passed attempt'
);
select ok(
  (select final_code = current_code and finished_at is not null
   from attempt where id = '70000000-0000-4000-8000-000000000008'),
  'submitting freezes the code and the end time'
);
select is(
  (select count(*) from process_event
   where attempt_id = '70000000-0000-4000-8000-000000000008' and type = 'submit'),
  1::bigint,
  'submitting records the submit event'
);
select throws_ok(
  $$ update attempt set current_code = 'x' where id = '70000000-0000-4000-8000-000000000008' $$,
  'P0001', null,
  'the code of a submitted attempt cannot change'
);
select throws_ok(
  $$ select submit_attempt('70000000-0000-4000-8000-000000000014') $$,
  'P0002', null,
  'a student cannot submit the attempt of another'
);

-- Editing the code (Hugo)
reset role;
select pg_temp.sign_in('10000000-0000-4000-8000-000000000012');

select throws_ok(
  $$ select submit_attempt('70000000-0000-4000-8000-000000000014') $$,
  'P0001', null,
  'an attempt that has not passed cannot be submitted'
);
update attempt set current_code = current_code || ' ' where id = '70000000-0000-4000-8000-000000000012';
select is(
  (select status::text from attempt where id = '70000000-0000-4000-8000-000000000012'),
  'in_progress',
  'changing the code after a failed run goes back to in progress'
);

reset role;
update attempt set status = 'passed' where id = '70000000-0000-4000-8000-000000000012';
select pg_temp.sign_in('10000000-0000-4000-8000-000000000012');

update attempt set current_code = current_code where id = '70000000-0000-4000-8000-000000000012';
select is(
  (select status::text from attempt where id = '70000000-0000-4000-8000-000000000012'),
  'passed',
  'saving the same code keeps the status'
);
update attempt set current_code = 'function max() {}' where id = '70000000-0000-4000-8000-000000000012';
select is(
  (select status::text from attempt where id = '70000000-0000-4000-8000-000000000012'),
  'in_progress',
  'changing the code after passing goes back to in progress'
);

-- The server (Edge Function execute) saves the code it ran with its result
reset role;
update attempt set current_code = 'function max() { return 1; }', status = 'tests_failed'
where id = '70000000-0000-4000-8000-000000000012';
select is(
  (select status::text from attempt where id = '70000000-0000-4000-8000-000000000012'),
  'tests_failed',
  'an update that sets the code and the status keeps that status'
);

-- Opening, by assignment. Hugo has submitted assignment ...001 (attempt ...009) and has no attempt
-- at ...007; ...503 is exercise 3 again, in the resit; ...502 is hidden, and so is the block of ...605.
select pg_temp.sign_in('10000000-0000-4000-8000-000000000012');

create temporary table opened on commit drop as
select * from open_attempt('60000000-0000-4000-8000-000000000007');
select ok(
  (select status = 'in_progress' and current_code = '' and number = 1
     and assignment_id = '60000000-0000-4000-8000-000000000007' from opened),
  'open_attempt creates attempt 1, in progress and linked to its assignment'
);
select is(
  (select id from open_attempt('60000000-0000-4000-8000-000000000007')),
  (select id from opened),
  'opening again returns the same attempt (two tabs never create two)'
);
select is(
  (select id from open_attempt('60000000-0000-4000-8000-000000000001')),
  '70000000-0000-4000-8000-000000000009'::uuid,
  'opening an assignment already started returns its attempt'
);
select ok(
  (select id <> '70000000-0000-4000-8000-000000000011'
     and exercise_id = '40000000-0000-4000-8000-000000000003'
   from open_attempt('60000000-0000-4000-8000-000000000503')),
  'the same exercise in another block is another attempt'
);
select throws_ok(
  $$ select open_attempt('60000000-0000-4000-8000-000000000001', 2) $$,
  'P0002', null,
  'opening an attempt number that does not exist finds nothing'
);
select throws_ok(
  $$ select open_attempt('60000000-0000-4000-8000-000000000502') $$,
  'P0002', null,
  'a student cannot open a hidden assignment'
);
select throws_ok(
  $$ select open_attempt('60000000-0000-4000-8000-000000000605') $$,
  'P0002', null,
  'nor an assignment of a hidden block'
);

-- Practising again (Hugo)
select is(
  (select id from retry_attempt('60000000-0000-4000-8000-000000000004')),
  '70000000-0000-4000-8000-000000000012'::uuid,
  'practising again an open attempt returns it'
);
create temporary table practised on commit drop as
select * from retry_attempt('60000000-0000-4000-8000-000000000001');
select ok(
  (select number = 2 and status = 'in_progress' and current_code = ''
     and exercise_id = '40000000-0000-4000-8000-000000000001' from practised),
  'practising a submitted attempt starts the next number, empty'
);
select is(
  (select id from retry_attempt('60000000-0000-4000-8000-000000000001')),
  (select id from practised),
  'practising again in another tab returns the same new attempt'
);
select is(
  (select id from open_attempt('60000000-0000-4000-8000-000000000001')),
  (select id from practised),
  'opening the assignment returns its latest attempt'
);
select is(
  (select id from open_attempt('60000000-0000-4000-8000-000000000001', 1)),
  '70000000-0000-4000-8000-000000000009'::uuid,
  'the previous attempt can still be opened by its number'
);
select throws_ok(
  $$ select retry_attempt('60000000-0000-4000-8000-000000000008') $$,
  'P0001', null,
  'an assignment never opened cannot be practised again'
);

reset role;
select pg_temp.sign_in('10000000-0000-4000-8000-000000000041');
select throws_ok(
  $$ select open_attempt('60000000-0000-4000-8000-000000000005') $$,
  'P0002', null,
  'a student cannot open an assignment of another group'
);

reset role;
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');
select is(
  (select assignment_id from open_attempt('60000000-0000-4000-8000-000000000605')),
  '60000000-0000-4000-8000-000000000605'::uuid,
  'a teacher can try the exercises of their groups, the hidden ones too'
);

reset role;
select pg_temp.sign_in('10000000-0000-4000-8000-000000000003');
select throws_ok(
  $$ select open_attempt('60000000-0000-4000-8000-000000000005') $$,
  'P0002', null,
  'a teacher cannot open the assignments of another teacher'
);

reset role;
set local role anon;
select throws_ok(
  $$ select open_attempt('60000000-0000-4000-8000-000000000001') $$,
  '42501', null,
  'an anonymous visitor cannot open attempts'
);

select * from finish();
rollback;
