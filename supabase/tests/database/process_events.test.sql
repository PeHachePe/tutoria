-- Step 2.1 · The browser only inserts its own events (docs/PLAN.md §2.8).
-- Seed: Hugo (...012) has exercise 6 in progress (...014) and exercise 1 submitted (...009);
-- attempt ...001 is Lucía's.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

create function pg_temp.sign_in(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
end;
$$;

select pg_temp.sign_in('10000000-0000-4000-8000-000000000012');

select lives_ok(
  $$ insert into process_event (attempt_id, type, timestamp, detail)
     values ('70000000-0000-4000-8000-000000000014', 'paste', '2000-01-01', '{"length": 12}') $$,
  'a student records a browser event in their open attempt'
);
select ok(
  (select received_at > timestamp from process_event
   where attempt_id = '70000000-0000-4000-8000-000000000014' and timestamp = '2000-01-01'),
  'the database keeps its own arrival time, which the client cannot fake'
);
select throws_ok(
  $$ insert into process_event (attempt_id, type, detail)
     values ('70000000-0000-4000-8000-000000000014', 'run', '{"passed": 5, "failed": 0, "failedTestIds": []}') $$,
  '42501', null,
  'a student cannot record server events'
);
select throws_ok(
  $$ insert into process_event (attempt_id, type) values ('70000000-0000-4000-8000-000000000001', 'focus_lost') $$,
  '42501', null,
  'a student cannot record events in the attempt of another'
);
select throws_ok(
  $$ insert into process_event (attempt_id, type) values ('70000000-0000-4000-8000-000000000009', 'focus_lost') $$,
  '42501', null,
  'a student cannot record events in a submitted attempt'
);
select throws_ok(
  $$ insert into process_event (attempt_id, type, received_at)
     values ('70000000-0000-4000-8000-000000000014', 'focus_lost', now()) $$,
  '42501', null,
  'a student cannot set the arrival time'
);
select throws_ok(
  $$ update process_event set detail = 'null' where attempt_id = '70000000-0000-4000-8000-000000000014' $$,
  '42501', null,
  'events cannot be changed'
);
select throws_ok(
  $$ delete from process_event where attempt_id = '70000000-0000-4000-8000-000000000014' $$,
  '42501', null,
  'events cannot be deleted'
);

select * from finish();
rollback;
