-- Step 2.3 · What the Edge Function `execute` keeps of a run. Seed: Hugo (...012) has exercise 4
-- with tests failed (attempt ...012); Lucía (...011) has exercise 8 passed (attempt ...008).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- The server records a run
set local role service_role;

select lives_ok(
  $$ select record_run('70000000-0000-4000-8000-000000000012', 'function maximo() { return 1; }',
                       'tests_failed', '{"passed": 3, "failed": 1, "failedTestIds": ["t"]}') $$,
  'the server records a run'
);
select ok(
  (select status = 'tests_failed' and current_code = 'function maximo() { return 1; }'
   from attempt where id = '70000000-0000-4000-8000-000000000012'),
  'a failed run with new code keeps its code and stays failed, not back in progress'
);
select is(
  (select detail from process_event
   where attempt_id = '70000000-0000-4000-8000-000000000012' and type = 'run'
   order by received_at desc, timestamp desc limit 1),
  '{"passed": 3, "failed": 1, "failedTestIds": ["t"]}'::jsonb,
  'a run records its event with the tests that failed'
);

select record_run('70000000-0000-4000-8000-000000000012', 'function maximo(v) { return 9; }',
                  'passed', '{"passed": 4, "failed": 0, "failedTestIds": []}');
select is(
  (select status::text from attempt where id = '70000000-0000-4000-8000-000000000012'),
  'passed',
  'a passing run passes the attempt'
);

select throws_ok(
  $$ select record_run('70000000-0000-4000-8000-000000000012', 'x', 'submitted', 'null') $$,
  'P0001', null,
  'a run cannot submit'
);
select throws_ok(
  $$ select record_run('00000000-0000-4000-8000-000000000000', 'x', 'passed', 'null') $$,
  'P0002', null,
  'a run of an attempt that does not exist is not found'
);

-- A submitted attempt is final
reset role;
update attempt set status = 'submitted', final_code = current_code, finished_at = now()
where id = '70000000-0000-4000-8000-000000000008';
set local role service_role;
select throws_ok(
  $$ select record_run('70000000-0000-4000-8000-000000000008', 'x', 'tests_failed', 'null') $$,
  'P0001', null,
  'a submitted attempt cannot run again'
);

-- Only the server records runs
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "10000000-0000-4000-8000-000000000012", "role": "authenticated"}', true);
select throws_ok(
  $$ select record_run('70000000-0000-4000-8000-000000000012', 'x', 'passed', 'null') $$,
  '42501', null,
  'a student cannot record a run and pass their own attempt'
);

reset role;
set local role anon;
select throws_ok(
  $$ select record_run('70000000-0000-4000-8000-000000000012', 'x', 'passed', 'null') $$,
  '42501', null,
  'an anonymous visitor cannot record a run'
);

select * from finish();
rollback;
