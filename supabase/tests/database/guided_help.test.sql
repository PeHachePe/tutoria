-- Step 7.0a · What a user saw and did of the guided help (docs/PLAN.md 2.12, D-080): only its owner
-- reads and writes it, and its shape and size are limited.
-- Seed users: the admin (...001), Marta, teacher of 1.º DAW A (...002), Lucía, her student (...011),
-- and Raúl, disabled (...050).
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

create function pg_temp.sign_in(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
end;
$$;

-- Lucía
select pg_temp.sign_in('10000000-0000-4000-8000-000000000011');

select is((select count(*) from user_guide_state), 0::bigint, 'nobody has saved any help in the seed');
select lives_ok(
  $$ insert into user_guide_state (user_id, state) values
     ('10000000-0000-4000-8000-000000000011', '{"welcome": 1, "done": {"run-tests": "2026-11-23T10:00:00.000Z"}}')
     on conflict (user_id) do update set user_id = excluded.user_id, state = excluded.state $$,
  'a user saves their own guide state'
);
select lives_ok(
  $$ insert into user_guide_state (user_id, state) values
     ('10000000-0000-4000-8000-000000000011', '{"welcome": 1, "firstStepsHidden": true}')
     on conflict (user_id) do update set user_id = excluded.user_id, state = excluded.state $$,
  'and saves it again whole, as the app does'
);
select is(
  (select state from user_guide_state),
  '{"welcome": 1, "firstStepsHidden": true}'::jsonb,
  'a user reads their own guide state'
);
select throws_ok(
  $$ insert into user_guide_state (user_id, state) values ('10000000-0000-4000-8000-000000000012', '{}') $$,
  '42501', null,
  'a user cannot save the guide state of another'
);
select throws_ok(
  $$ update user_guide_state set user_id = '10000000-0000-4000-8000-000000000012' $$,
  '42501', null,
  'nor give theirs to another'
);
select throws_ok(
  $$ update user_guide_state set state = '{"theme": "dark"}' $$,
  '23514', null,
  'only the keys of the guided help'
);
select throws_ok(
  $$ update user_guide_state set state = '{"welcome": "yes"}' $$,
  '23514', null,
  'each with its type'
);
select throws_ok(
  $$ update user_guide_state set state = '{"done": {"run-tests": true}}' $$,
  '23514', null,
  'a finished task keeps its date'
);
select throws_ok(
  format(
    $$ update user_guide_state set state = '{"done": {"a": "%s"}}' $$,
    repeat('x', 9000)
  ),
  '23514', null,
  'and the whole state is small'
);
select throws_ok(
  $$ update user_guide_state set updated_at = '2000-01-01' $$,
  '42501', null,
  'the time of the last change is the server''s'
);

-- Marta, Lucía's teacher, and the administration
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');
select is((select count(*) from user_guide_state), 0::bigint, 'a teacher does not read the help of their students');

select pg_temp.sign_in('10000000-0000-4000-8000-000000000001');
select is((select count(*) from user_guide_state), 0::bigint, 'nor does the administration');

-- Raúl, disabled
select pg_temp.sign_in('10000000-0000-4000-8000-000000000050');
select throws_ok(
  $$ insert into user_guide_state (user_id, state) values ('10000000-0000-4000-8000-000000000050', '{}') $$,
  '42501', null,
  'a disabled user saves nothing'
);

select * from finish();
rollback;
