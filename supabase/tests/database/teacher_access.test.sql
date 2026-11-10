-- Step 2.1 · What teachers and administrators reach (docs/PLAN.md §2.3).
-- Seed users: Marta teaches 1.º DAW A (...002, group ...001), Javier teaches 1.º DAM B (...003,
-- group ...002), the administrator is ...001. Lucía (...011) is in DAW A; Elena (...041), in DAM B.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

create function pg_temp.sign_in(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
end;
$$;

-- Marta
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');

select results_eq(
  'select id from class_group',
  $$ values ('20000000-0000-4000-8000-000000000001'::uuid) $$,
  'a teacher only sees their groups'
);
select is(
  (select count(*) from attempt where user_id = '10000000-0000-4000-8000-000000000041'),
  0::bigint,
  'a teacher does not see the attempts of students in other groups'
);
select is(
  (select count(*) from attempt where user_id = '10000000-0000-4000-8000-000000000011'),
  8::bigint,
  'a teacher sees the attempts of their students'
);
select ok(
  (select count(*) from process_event e join attempt a on a.id = e.attempt_id
   where a.user_id = '10000000-0000-4000-8000-000000000011') > 0,
  'a teacher sees the events of their students'
);
select is((select count(*) from app_user), 25::bigint, 'a teacher reads themselves and their 24 students');
select is((select count(*) from test where is_hidden), 8::bigint, 'a teacher reads the hidden tests');
select is((select count(*) from exercise), 8::bigint, 'teachers share the whole exercise bank');
select lives_ok(
  $$ insert into class_session (group_id, number) values ('20000000-0000-4000-8000-000000000001', 9) $$,
  'a teacher adds sessions to their groups'
);
select throws_ok(
  $$ insert into class_session (group_id, number) values ('20000000-0000-4000-8000-000000000002', 9) $$,
  '42501', null,
  'a teacher cannot add sessions to the groups of another'
);
select throws_ok(
  $$ delete from exercise where id = '40000000-0000-4000-8000-000000000001' $$,
  '23503', null,
  'an exercise with attempts cannot be deleted'
);
select throws_ok(
  $$ insert into tutor_interaction (attempt_id, trigger, hint_level, transcript, emotion, intensity, prompt_version)
     values ('70000000-0000-4000-8000-000000000001', 'hint', 1, 'x', 'joy', 1, 'v1') $$,
  '42501', null,
  'only the server writes tutor interactions'
);
select is((select count(*) from app_setting), 0::bigint, 'a teacher cannot read the settings');

-- Administrator
reset role;
select pg_temp.sign_in('10000000-0000-4000-8000-000000000001');

select is((select count(*) from attempt), 202::bigint, 'an administrator sees every attempt');
select is((select count(*) from app_setting), 1::bigint, 'an administrator reads the settings');

select * from finish();
rollback;
