-- Step 2.1 · The browser only inserts its own events (docs/PLAN.md §2.8), within limits (D-062).
-- Seed: Hugo (...012) has exercise 6 in progress (...014), without browser events, and exercise 1
-- submitted (...009); attempt ...001 is Lucía's.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

create function pg_temp.sign_in(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
end;
$$;

select pg_temp.sign_in('10000000-0000-4000-8000-000000000012');

select lives_ok(
  $$ insert into process_event (attempt_id, type, timestamp, detail) values
     ('70000000-0000-4000-8000-000000000014', 'paste', '2000-01-01', '{"length": 12}'),
     ('70000000-0000-4000-8000-000000000014', 'focus_lost', '2100-01-01', 'null') $$,
  'a student records browser events in their open attempt'
);
select is(
  (select timestamp from process_event
   where attempt_id = '70000000-0000-4000-8000-000000000014' and type = 'paste'),
  (select started_at from attempt where id = '70000000-0000-4000-8000-000000000014'),
  'an event does not happen before its attempt was opened, whatever the browser says'
);
select is(
  (select timestamp from process_event
   where attempt_id = '70000000-0000-4000-8000-000000000014' and type = 'focus_lost'),
  now(),
  'nor after it reached the database, whose arrival time the client cannot fake'
);
select throws_ok(
  $$ insert into process_event (attempt_id, type, detail) values
     ('70000000-0000-4000-8000-000000000014', 'paste', jsonb_build_object('length', repeat('9', 200))) $$,
  '23514', null,
  'the detail of a browser event is small'
);
select lives_ok(
  $$ insert into process_event (attempt_id, type, detail)
     select '70000000-0000-4000-8000-000000000014', 'focus_lost', 'null' from generate_series(1, 100) $$,
  'a batch within the limits is recorded'
);
select throws_ok(
  $$ insert into process_event (attempt_id, type, detail)
     select '70000000-0000-4000-8000-000000000014', 'focus_lost', 'null' from generate_series(1, 300) $$,
  'P0001', null,
  'an attempt takes no more than 300 browser events in a minute'
);

-- 2 850 more that arrived an hour ago: with the 102 above, near the 3 000 an attempt takes
reset role;
insert into process_event (attempt_id, type, detail, received_at)
select '70000000-0000-4000-8000-000000000014', 'focus_lost', 'null', now() - interval '1 hour'
from generate_series(1, 2850);
select pg_temp.sign_in('10000000-0000-4000-8000-000000000012');

select throws_ok(
  $$ insert into process_event (attempt_id, type, detail)
     select '70000000-0000-4000-8000-000000000014', 'focus_lost', 'null' from generate_series(1, 100) $$,
  'P0001', null,
  'nor more than 3 000 in all'
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
