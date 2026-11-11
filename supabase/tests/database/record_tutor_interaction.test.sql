-- Step 2.4 · What the Edge Function `tutor` keeps of each answer. Seed: Hugo (...012) has exercise 4
-- with tests failed (attempt ...012); Lucía (...011) has exercise 8 passed (attempt ...008).
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

set local role service_role;

-- A hint keeps its answer and its event
select isnt(
  record_tutor_interaction('70000000-0000-4000-8000-000000000012',
    'a0000000-0000-4000-8000-000000000001', 'hint', 2::smallint, null, '¿Qué pasa con el primero?',
    'encouragement', 2::smallint, false, 'v1', 'gemini-test', false),
  null,
  'a hint returns the id of its answer'
);
select ok(
  (select trigger = 'hint' and hint_level = 2 and prompt_version = 'v1' and model = 'gemini-test'
   from tutor_interaction where request_id = 'a0000000-0000-4000-8000-000000000001'),
  'the answer keeps its level, its prompt version and its model'
);
select is(
  (select rejected_answers from tutor_interaction
   where request_id = 'a0000000-0000-4000-8000-000000000001'),
  0::smallint,
  'an answer the validator took at once has no rejected answers'
);
select is(
  (select detail from process_event
   where attempt_id = '70000000-0000-4000-8000-000000000012' and type = 'hint_requested'
   order by received_at desc, timestamp desc limit 1),
  '{"level": 2}'::jsonb,
  'a hint records its event with its level'
);

-- A question keeps only its answer
select record_tutor_interaction('70000000-0000-4000-8000-000000000012',
  'a0000000-0000-4000-8000-000000000002', 'question', 2::smallint, '¿Y ahora?', 'Mira el bucle.',
  'joy', 1::smallint, false, 'v1', 'gemini-test', false);
select ok(
  (select student_message = '¿Y ahora?' from tutor_interaction
   where request_id = 'a0000000-0000-4000-8000-000000000002'),
  'a question keeps what the student asked'
);

-- The validator turned down both answers of the model: the student got the default (2.5)
select record_tutor_interaction('70000000-0000-4000-8000-000000000012',
  'a0000000-0000-4000-8000-000000000008', 'question', 2::smallint, 'Dámela', '¡Vas bien!',
  'encouragement', 1::smallint, true, 'v2', 'gemini-test', false, 2::smallint);
select ok(
  (select rejected_answers = 2 and elusion from tutor_interaction
   where request_id = 'a0000000-0000-4000-8000-000000000008'),
  'the answer keeps how many answers of the model were turned down'
);

-- The same request twice is one answer
select throws_ok(
  $$ select record_tutor_interaction('70000000-0000-4000-8000-000000000012',
       'a0000000-0000-4000-8000-000000000002', 'question', 2::smallint, '¿Y ahora?', 'Otra vez.',
       'joy', 1::smallint, false, 'v1', 'gemini-test', false) $$,
  '23505', null,
  'a request is answered once'
);

-- An intervention the model chose not to make keeps only its event
select is(
  record_tutor_interaction('70000000-0000-4000-8000-000000000012',
    'a0000000-0000-4000-8000-000000000003', 'proactive', 2::smallint, null, '', 'encouragement',
    1::smallint, false, 'v1', 'gemini-test', true),
  null,
  'a silent intervention has no answer'
);
select is(
  (select detail from process_event
   where attempt_id = '70000000-0000-4000-8000-000000000012' and type = 'proactive_intervention'
   order by received_at desc, timestamp desc limit 1),
  '{"silent": true}'::jsonb,
  'a silent intervention records its event'
);
select throws_ok(
  $$ select record_tutor_interaction('70000000-0000-4000-8000-000000000012',
       'a0000000-0000-4000-8000-000000000004', 'hint', 1::smallint, null, '', 'joy', 1::smallint,
       false, 'v1', 'm', true) $$,
  'P0001', null,
  'only an intervention may keep quiet'
);

-- The limit counts every call of the last minute: the three answers and the silent intervention
select is(
  (select count(*)::integer from latest_tutor_calls('10000000-0000-4000-8000-000000000012',
     now() - interval '1 minute', 10)),
  4,
  'the latest calls count the answers and the silent interventions'
);

select throws_ok(
  $$ select record_tutor_interaction('00000000-0000-4000-8000-000000000000',
       'a0000000-0000-4000-8000-000000000005', 'hint', 1::smallint, null, 'x', 'joy', 1::smallint,
       false, 'v1', 'm', false) $$,
  'P0002', null,
  'an attempt that does not exist is not found'
);

-- A submitted attempt gets no more help
reset role;
update attempt set status = 'submitted', final_code = current_code, finished_at = now()
where id = '70000000-0000-4000-8000-000000000008';
set local role service_role;
select throws_ok(
  $$ select record_tutor_interaction('70000000-0000-4000-8000-000000000008',
       'a0000000-0000-4000-8000-000000000006', 'hint', 1::smallint, null, 'x', 'joy', 1::smallint,
       false, 'v1', 'm', false) $$,
  'P0001', null,
  'a submitted attempt gets no more help'
);

-- Only the server records answers
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "10000000-0000-4000-8000-000000000012", "role": "authenticated"}', true);
select throws_ok(
  $$ select record_tutor_interaction('70000000-0000-4000-8000-000000000012',
       'a0000000-0000-4000-8000-000000000007', 'question', 1::smallint, 'x', 'La solución es…',
       'joy', 1::smallint, false, 'v1', 'm', false) $$,
  '42501', null,
  'a student cannot write the answers of the tutor'
);

select * from finish();
rollback;
