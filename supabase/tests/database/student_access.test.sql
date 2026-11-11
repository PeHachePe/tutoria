-- Step 2.1 · What a student reads and writes (docs/PLAN.md §2.3).
-- Seed users: Lucía (1.º DAW A, ...011), Hugo (1.º DAW A, ...012), Elena (1.º DAM B, ...041) and
-- Raúl, disabled (...050). 1.º DAW A has the 15 exercises of basic programming and, in its web
-- client group, the 15 of web development; 1.º DAM B, those of basic and advanced programming.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

create function pg_temp.sign_in(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
end;
$$;

-- Lucía
select pg_temp.sign_in('10000000-0000-4000-8000-000000000011');

select is(
  (select count(*) from attempt where user_id <> '10000000-0000-4000-8000-000000000011'),
  0::bigint,
  'a student does not see the attempts of another'
);
select is((select count(*) from attempt), 10::bigint, 'a student sees all their attempts');
select is(
  (select count(*) from process_event e join attempt a on a.id = e.attempt_id
   where a.user_id <> '10000000-0000-4000-8000-000000000011'),
  0::bigint,
  'a student does not see the events of another'
);
select is((select count(*) from test where is_hidden), 0::bigint, 'a student cannot read the hidden tests');
select ok((select count(*) from test) > 0, 'a student reads the visible tests of their exercises');
select is((select count(*) from app_user), 1::bigint, 'a student only reads their own user');
select is((select count(*) from app_setting), 0::bigint, 'a student cannot read the settings');

select throws_ok(
  $$ update attempt set status = 'passed' where id = '70000000-0000-4000-8000-000000000008' $$,
  '42501', null,
  'a student cannot set the status of their attempt'
);
select throws_ok(
  $$ update attempt set final_code = 'x' where id = '70000000-0000-4000-8000-000000000008' $$,
  '42501', null,
  'a student cannot set the final code of their attempt'
);
select throws_ok(
  $$ insert into attempt (exercise_id, user_id) values
     ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000011') $$,
  '42501', null,
  'a student cannot create attempts directly (only with open_attempt)'
);
select is_empty(
  $$ update attempt set current_code = 'x' where id = '70000000-0000-4000-8000-000000000014' returning id $$,
  'a student cannot change the code of another student'
);
select throws_ok(
  $$ update app_user set role = 'admin' where id = '10000000-0000-4000-8000-000000000011' $$,
  '42501', null,
  'a student cannot change their own role'
);
select lives_ok(
  $$ update app_user set privacy_notice_seen_at = now() where id = '10000000-0000-4000-8000-000000000011' $$,
  'a student records that they saw the data notice'
);
select isnt(
  (select privacy_notice_seen_at from app_user where id = '10000000-0000-4000-8000-000000000011'),
  null,
  'the data notice is recorded on the server'
);

-- Elena, in groups without exercise 9 (web development only)
reset role;
select pg_temp.sign_in('10000000-0000-4000-8000-000000000041');
select is(
  (select count(*) from exercise where id = '40000000-0000-4000-8000-000000000009'),
  0::bigint,
  'a student does not see the exercises not assigned to their groups'
);

-- Raúl, disabled
reset role;
select pg_temp.sign_in('10000000-0000-4000-8000-000000000050');
select is(
  (select count(*) from exercise) + (select count(*) from attempt) + (select count(*) from app_user),
  0::bigint,
  'a disabled user reads nothing'
);

-- Not signed in
reset role;
set local role anon;
select throws_ok('select * from attempt', '42501', null, 'an anonymous visitor cannot read any table');

select * from finish();
rollback;
