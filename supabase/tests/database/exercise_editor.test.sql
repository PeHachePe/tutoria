-- Step 4.3 · The exercise editor: authors, `save_exercise` and `exercise_student_counts` (D-057).
-- Marta (...002) wrote exercises 1 to 30; Javier (...003), those of advanced programming, 31 to 42.
-- Elena (...041) is a student of Javier.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

create function pg_temp.sign_in(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
end;
$$;

create function pg_temp.fields(title text, parameters jsonb default '["numbers"]') returns jsonb
language sql as $$
  select jsonb_build_object(
    'title', title, 'statement', 'Escribe una función `product`.', 'difficulty', 'medium',
    'topics', '["Vectores"]'::jsonb, 'source_locale', 'es', 'translations', '{}'::jsonb,
    'function_name', 'product', 'parameters', parameters,
    'max_repeated_failures', 2, 'max_idle_minutes', 5
  );
$$;

create temporary table saved (id uuid) on commit drop;
grant all on saved to authenticated;

-- Marta
select pg_temp.sign_in('10000000-0000-4000-8000-000000000002');

insert into saved
select id from save_exercise(
  null,
  pg_temp.fields('Producto'),
  '[{"input": [[2, 3]], "expected_output": 6}, {"input": [[]], "expected_output": 1, "is_hidden": true}]',
  array['b0000000-0000-4000-8000-000000000001'::uuid]
);

select results_eq(
  $$ select created_by, parameters from exercise where id = (select id from saved) $$,
  $$ values ('10000000-0000-4000-8000-000000000002'::uuid, array['numbers']) $$,
  'a teacher creates an exercise as its author, with its parameters'
);
select results_eq(
  $$ select position, is_hidden, expected_output from test
     where exercise_id = (select id from saved) order by position $$,
  $$ values (0, false, '6'::jsonb), (1, true, '1'::jsonb) $$,
  'its tests keep their order and whether they are hidden'
);
select is(
  (select count(*) from exercise_subject where exercise_id = (select id from saved)),
  1::bigint,
  'and its subjects'
);

select lives_ok(
  $$ select save_exercise(
       '40000000-0000-4000-8000-000000000001', pg_temp.fields('Suma'),
       '[{"input": [[1]], "expected_output": 1}]', '{}') $$,
  'a teacher saves her own exercise'
);
select is(
  (select count(*) from test where exercise_id = '40000000-0000-4000-8000-000000000001'),
  1::bigint,
  'saving replaces its tests'
);
select is(
  (select count(*) from exercise_subject where exercise_id = '40000000-0000-4000-8000-000000000001'),
  0::bigint,
  'and its subjects'
);

select throws_ok(
  $$ select save_exercise(
       '40000000-0000-4000-8000-000000000031', pg_temp.fields('Ajeno'),
       '[{"input": [1], "expected_output": 1}]', '{}') $$,
  'P0002',
  'Exercise not found',
  'a teacher cannot save the exercise of another teacher'
);
delete from exercise where id = '40000000-0000-4000-8000-000000000031';
select is(
  (select count(*) from exercise where id = '40000000-0000-4000-8000-000000000031'),
  1::bigint,
  'nor delete it'
);
select throws_ok(
  $$ insert into test (exercise_id, input, expected_output, position)
     values ('40000000-0000-4000-8000-000000000031', '[1]', '1', 99) $$,
  '42501',
  null,
  'nor add tests to it'
);
select throws_ok(
  $$ select save_exercise(null, pg_temp.fields('Mal', '["año"]'), '[{"input": [], "expected_output": 1}]', '{}') $$,
  '23514',
  null,
  'parameters are plain identifiers'
);
select throws_ok(
  $$ select save_exercise(null, pg_temp.fields('Sin pruebas'), '[]', '{}') $$,
  'P0001',
  'An exercise needs at least one test',
  'an exercise needs a test'
);

select ok(
  (select student_count from exercise_student_counts()
   where exercise_id = '40000000-0000-4000-8000-000000000001')
  > (select count(distinct user_id) from attempt
     where exercise_id = '40000000-0000-4000-8000-000000000001'),
  'the counts include the students of other teachers, whose attempts she cannot read'
);

-- The administrator
select pg_temp.sign_in('10000000-0000-4000-8000-000000000001');

select lives_ok(
  $$ select save_exercise(
       '40000000-0000-4000-8000-000000000031', pg_temp.fields('De Javier'),
       '[{"input": [1], "expected_output": 1}]', '{}') $$,
  'the administrator saves any exercise'
);

-- Elena
select pg_temp.sign_in('10000000-0000-4000-8000-000000000041');

select throws_ok(
  'select * from exercise_student_counts()',
  '42501',
  null,
  'students do not read the use of the bank'
);

select * from finish();
rollback;
