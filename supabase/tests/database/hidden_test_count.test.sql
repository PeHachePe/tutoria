-- Step 2.2 · The count of hidden tests a student may know (docs/PLAN.md §2.5).
-- Lucía (1.º DAW A, ...011) has the exercises of basic programming and web development; Elena
-- (1.º DAM B, ...041), those of basic and advanced programming, never exercise 9 (web only).
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

create function pg_temp.sign_in(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
end;
$$;

-- What the count must be, read before signing in (the hidden tests are invisible afterwards)
create temporary table expected as
  select exercise_id, count(*)::integer as hidden from test where is_hidden group by exercise_id;
grant select on expected to authenticated;

select pg_temp.sign_in('10000000-0000-4000-8000-000000000011');
select is(
  hidden_test_count('40000000-0000-4000-8000-000000000003'),
  (select hidden from expected where exercise_id = '40000000-0000-4000-8000-000000000003'),
  'a student learns how many hidden tests an assigned exercise has'
);

select pg_temp.sign_in('10000000-0000-4000-8000-000000000041');
select throws_ok(
  $$ select hidden_test_count('40000000-0000-4000-8000-000000000009') $$,
  'P0002', null,
  'a student cannot count the hidden tests of an exercise not assigned to them'
);

-- Marta, a teacher
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');
select is(
  hidden_test_count('40000000-0000-4000-8000-000000000008'),
  (select hidden from expected where exercise_id = '40000000-0000-4000-8000-000000000008'),
  'staff count the hidden tests of any exercise'
);

reset role;
set role anon;
select throws_ok(
  $$ select hidden_test_count('40000000-0000-4000-8000-000000000003') $$,
  '42501', null,
  'a visitor without a session cannot call it'
);

select * from finish();
rollback;
