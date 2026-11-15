-- Step 4.3e · The limit of the tutor in preview mode (D-061). Seed: Marta teaches (...002) and Lucía
-- (...011) is a student.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

set local role service_role;

select is(
  claim_staff_request('10000000-0000-4000-8000-000000000002', 'tutor', 1),
  0,
  'a teacher may ask the tutor in preview mode'
);
select ok(
  claim_staff_request('10000000-0000-4000-8000-000000000002', 'tutor', 1) between 1 and 60,
  'past the limit, the seconds to wait'
);
select is(
  claim_staff_request('10000000-0000-4000-8000-000000000002', 'check', 1),
  0,
  'checking a solution keeps its own limit'
);
select throws_ok(
  $$ select claim_staff_request('10000000-0000-4000-8000-000000000011', 'tutor', 10) $$,
  'P0003', null,
  'a student may not'
);

select * from finish();
rollback;
