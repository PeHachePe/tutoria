-- Step 2.1 · Transitions of an attempt (docs/PLAN.md §2.4): only the server writes the status.
-- Seed: Lucía (...011) has exercise 8 passed (attempt ...008); Hugo (...012) has exercise 4 with
-- tests failed (...012), exercise 6 in progress (...014) and no attempt at exercise 7; Elena
-- (...041) is in 1.º DAM B, without exercise 5; Marta (...002) is a teacher.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

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

-- Opening (Hugo, Elena and Marta)
select pg_temp.sign_in('10000000-0000-4000-8000-000000000012');

create temporary table opened on commit drop as
select * from open_attempt('40000000-0000-4000-8000-000000000007');
select ok(
  (select status = 'in_progress' and current_code = '' and assignment_id is not null from opened),
  'open_attempt creates the attempt, in progress and linked to its assignment'
);
select is(
  (select id from open_attempt('40000000-0000-4000-8000-000000000007')),
  (select id from opened),
  'opening again returns the same attempt (two tabs never create two)'
);
select is(
  (select count(*) from attempt where exercise_id = '40000000-0000-4000-8000-000000000007'),
  1::bigint,
  'there is only one attempt per student and exercise'
);
select is(
  (select id from open_attempt('40000000-0000-4000-8000-000000000001')),
  '70000000-0000-4000-8000-000000000009'::uuid,
  'opening an exercise already started returns its attempt'
);

reset role;
select pg_temp.sign_in('10000000-0000-4000-8000-000000000041');
select throws_ok(
  $$ select open_attempt('40000000-0000-4000-8000-000000000005') $$,
  'P0002', null,
  'a student cannot open an exercise not assigned to them'
);

reset role;
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');
select is(
  (select assignment_id from open_attempt('40000000-0000-4000-8000-000000000005')),
  null,
  'a teacher can try any exercise, without an assignment'
);

reset role;
set local role anon;
select throws_ok(
  $$ select open_attempt('40000000-0000-4000-8000-000000000001') $$,
  '42501', null,
  'an anonymous visitor cannot open attempts'
);

select * from finish();
rollback;
