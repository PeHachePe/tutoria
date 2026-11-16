-- Security review of the Edge Functions (D-063): the turns of a student, the queries the tutor
-- waits for, the attempts that are still open and the shape of the AI provider. Seed: Hugo (...012)
-- has attempt ...014 in progress at assignment ...006 of block ...004 of group ...001, where Lucía
-- (...011) is enrolled too; the administrator is ...001.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

set local role service_role;

-- The turns of a student ---------------------------------------------------------------------------

select is(
  claim_student_request('10000000-0000-4000-8000-000000000012', 'run', 2),
  0,
  'a student takes a turn'
);
select is(
  claim_student_request('10000000-0000-4000-8000-000000000012', 'run', 2),
  0,
  'and another, up to the limit of the minute'
);
select ok(
  claim_student_request('10000000-0000-4000-8000-000000000012', 'run', 2) between 1 and 60,
  'past it, the seconds to wait'
);
select is(
  (select count(*) from student_request
   where user_id = '10000000-0000-4000-8000-000000000012' and kind = 'run'),
  2::bigint,
  'a turn past the limit is not recorded'
);
select is(
  claim_student_request('10000000-0000-4000-8000-000000000012', 'tutor', 2),
  0,
  'each kind has its own limit'
);
select is(
  claim_student_request('10000000-0000-4000-8000-000000000011', 'run', 2),
  0,
  'and each student, theirs'
);

-- Per day: two turns of yesterday afternoon, one of two days ago
reset role;
insert into student_request (user_id, kind, received_at) values
  ('10000000-0000-4000-8000-000000000011', 'tutor', now() - interval '30 hours'),
  ('10000000-0000-4000-8000-000000000011', 'tutor', now() - interval '20 hours'),
  ('10000000-0000-4000-8000-000000000011', 'tutor', now() - interval '18 hours');
set local role service_role;
select is(
  claim_student_request('10000000-0000-4000-8000-000000000011', 'tutor', 6, 3),
  0,
  'a turn older than a day does not count for the day'
);
select ok(
  claim_student_request('10000000-0000-4000-8000-000000000011', 'tutor', 6, 3)
    between 3 * 3600 and 4 * 3600,
  'past the limit of the day, the seconds until the oldest of the day leaves it'
);
select is(
  claim_student_request('10000000-0000-4000-8000-000000000011', 'tutor', 6),
  0,
  'without a limit per day, only the minute counts'
);
reset role;
select is(
  (select count(*) from student_request
   where user_id = '10000000-0000-4000-8000-000000000011' and kind = 'tutor'),
  4::bigint,
  'and what is older than a day is gone'
);

-- The queries the tutor waits for ------------------------------------------------------------------

set local role service_role;
select lives_ok(
  $$ select keep_tutor_queries('a0000000-0000-4000-8000-0000000000a1',
       '10000000-0000-4000-8000-000000000012', '[{"name": "getMyProgress", "arguments": {}}]') $$,
  'the queries of a request are kept'
);
select is(
  take_tutor_queries('a0000000-0000-4000-8000-0000000000a1',
    '10000000-0000-4000-8000-000000000011'),
  null,
  'another user does not take them'
);
select is(
  take_tutor_queries('a0000000-0000-4000-8000-0000000000a2',
    '10000000-0000-4000-8000-000000000012'),
  null,
  'nor another request'
);
select is(
  take_tutor_queries('a0000000-0000-4000-8000-0000000000a1',
    '10000000-0000-4000-8000-000000000012'),
  '[{"name": "getMyProgress", "arguments": {}}]'::jsonb,
  'their user takes them'
);
select is(
  take_tutor_queries('a0000000-0000-4000-8000-0000000000a1',
    '10000000-0000-4000-8000-000000000012'),
  null,
  'once'
);

-- Asked again in the same request, the newest stay; the request id of another user is left alone
select keep_tutor_queries('a0000000-0000-4000-8000-0000000000a3',
  '10000000-0000-4000-8000-000000000012', '[{"name": "getSettings", "arguments": {}}]');
select keep_tutor_queries('a0000000-0000-4000-8000-0000000000a3',
  '10000000-0000-4000-8000-000000000012', '[{"name": "getMyProgress", "arguments": {}}]');
select keep_tutor_queries('a0000000-0000-4000-8000-0000000000a3',
  '10000000-0000-4000-8000-000000000011', '[{"name": "getSettings", "arguments": {}}]');
select is(
  take_tutor_queries('a0000000-0000-4000-8000-0000000000a3',
    '10000000-0000-4000-8000-000000000012') -> 0 ->> 'name',
  'getMyProgress',
  'a request keeps the last queries of its own user'
);

-- Queries nobody answered are not taken after a while, and go with the next ones
reset role;
insert into tutor_pending_query (request_id, user_id, calls, asked_at) values
  ('a0000000-0000-4000-8000-0000000000a4', '10000000-0000-4000-8000-000000000012', '[]',
   now() - interval '11 minutes');
set local role service_role;
select is(
  take_tutor_queries('a0000000-0000-4000-8000-0000000000a4',
    '10000000-0000-4000-8000-000000000012'),
  null,
  'old queries are not taken'
);
select keep_tutor_queries('a0000000-0000-4000-8000-0000000000a5',
  '10000000-0000-4000-8000-000000000012', '[]');
reset role;
select is(
  (select count(*) from tutor_pending_query
   where user_id = '10000000-0000-4000-8000-000000000012'),
  1::bigint,
  'and are dropped when the user is asked again'
);

-- An attempt is worked on while its assignment is open ---------------------------------------------

set local role service_role;
select ok(
  is_open_attempt('70000000-0000-4000-8000-000000000014'),
  'an attempt at a visible assignment of a group of its student is open'
);
select ok(
  not is_open_attempt('00000000-0000-4000-8000-000000000000'),
  'one that does not exist is not'
);

reset role;
update class_block set is_hidden = true where id = 'a0000000-0000-4000-8000-000000000004';
select ok(
  not is_open_attempt('70000000-0000-4000-8000-000000000014'),
  'with its block hidden, it is not'
);
update class_block set is_hidden = false, opens_at = now() + interval '1 day'
where id = 'a0000000-0000-4000-8000-000000000004';
select ok(
  not is_open_attempt('70000000-0000-4000-8000-000000000014'),
  'nor before its block opens'
);
update class_block set opens_at = null where id = 'a0000000-0000-4000-8000-000000000004';
update exercise_assignment set is_hidden = true
where id = '60000000-0000-4000-8000-000000000006';
select ok(
  not is_open_attempt('70000000-0000-4000-8000-000000000014'),
  'nor with its assignment hidden'
);
update exercise_assignment set is_hidden = false
where id = '60000000-0000-4000-8000-000000000006';
delete from enrollment
where user_id = '10000000-0000-4000-8000-000000000012'
  and group_id = '20000000-0000-4000-8000-000000000001';
select ok(
  not is_open_attempt('70000000-0000-4000-8000-000000000014'),
  'nor when its student left the group'
);

-- The setting of the AI provider -------------------------------------------------------------------

select ok(
  is_valid_ai_provider('{"baseUrl": "https://llm.test/v1", "model": "flash", "timeoutMs": 10000,
    "fallbacks": ["lite", {"model": "local", "baseUrl": "http://host.docker.internal:11434/v1"}]}'),
  'a main model with a URL of the web and its fallbacks is a provider'
);
select ok(
  not is_valid_ai_provider('{"baseUrl": "file:///etc/passwd", "model": "x"}')
    and not is_valid_ai_provider('{"baseUrl": "llm.test/v1", "model": "x"}')
    and not is_valid_ai_provider('{"baseUrl": "https://llm.test/v1", "model": " "}')
    and not is_valid_ai_provider('{"model": "x"}')
    and not is_valid_ai_provider('["https://llm.test/v1"]'),
  'without a URL of the web or a model, it is not'
);
select ok(
  not is_valid_ai_provider('{"baseUrl": "https://llm.test/v1", "model": "x", "fallbacks": "y"}')
    and not is_valid_ai_provider(
      '{"baseUrl": "https://llm.test/v1", "model": "x", "fallbacks": [1]}')
    and not is_valid_ai_provider(
      '{"baseUrl": "https://llm.test/v1", "model": "x",
        "fallbacks": [{"model": "y", "baseUrl": "gopher://llm.test"}]}')
    and not is_valid_ai_provider(
      '{"baseUrl": "https://llm.test/v1", "model": "x",
        "fallbacks": ["a", "b", "c", "d", "e", "f"]}'),
  'nor with fallbacks that are not models, go elsewhere or are more than five'
);

-- The administration writes the setting, and only a valid one
set local role authenticated;
set local request.jwt.claims to '{"sub": "10000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select throws_ok(
  $$ update app_setting set value = '{"baseUrl": "file:///etc/passwd", "model": "x"}'
     where key = 'ai_provider' $$,
  '23514', null,
  'the administration cannot write a provider that is not one'
);
select lives_ok(
  $$ update app_setting set value = '{"baseUrl": "https://llm.test/v1", "model": "x"}'
     where key = 'ai_provider' $$,
  'but a valid one, yes'
);

-- Nobody reaches the turns or the queries from the app
select throws_ok(
  'select * from student_request',
  '42501', null,
  'the app cannot read the turns'
);

select * from finish();
rollback;
