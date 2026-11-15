-- Step 4.3c · The limit of the requests of the staff (D-059). Seed: Marta teaches (...002), the
-- administrator is ...001 and Lucía (...011) is a student.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

set local role service_role;

select is(
  claim_staff_request('10000000-0000-4000-8000-000000000002', 'check', 2),
  0,
  'a teacher may check a solution'
);
select is(
  claim_staff_request('10000000-0000-4000-8000-000000000002', 'check', 2),
  0,
  'and again, up to the limit'
);
select ok(
  claim_staff_request('10000000-0000-4000-8000-000000000002', 'check', 2) between 1 and 60,
  'past the limit, the seconds to wait'
);
select is(
  (select count(*) from staff_request where user_id = '10000000-0000-4000-8000-000000000002'),
  2::bigint,
  'a request past the limit is not recorded'
);
select is(
  claim_staff_request('10000000-0000-4000-8000-000000000002', 'translate', 2),
  0,
  'each kind has its own limit'
);
select is(
  claim_staff_request('10000000-0000-4000-8000-000000000001', 'translate', 1),
  0,
  'the administrator may too'
);
select throws_ok(
  $$ select claim_staff_request('10000000-0000-4000-8000-000000000011', 'check', 10) $$,
  'P0003', null,
  'a student may not'
);

reset role;
update app_user set status = 'disabled' where id = '10000000-0000-4000-8000-000000000002';
set local role service_role;
select throws_ok(
  $$ select claim_staff_request('10000000-0000-4000-8000-000000000002', 'check', 10) $$,
  'P0003', null,
  'nor a disabled teacher'
);

-- Nobody reaches it from the app
reset role;
set local role authenticated;
select throws_ok(
  'select * from staff_request',
  '42501', null,
  'the app cannot read the requests'
);

select * from finish();
rollback;
