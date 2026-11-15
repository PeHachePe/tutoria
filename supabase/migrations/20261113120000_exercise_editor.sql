-- Step 4.3 · The teacher's exercise bank and editor (docs/PLAN.md §2.3, D-057).
--
-- - The names of the parameters of the function, in English like the function: the tutor's
--   skeleton uses them instead of making up others (D-049), so it never writes `count(palabra)`.
-- - The bank is shared, but only its author or the administration changes or deletes an exercise,
--   its tests and its subjects. The others read it and duplicate it to adapt it.
-- - `save_exercise` writes an exercise, its tests and its subjects at once.
-- - `exercise_student_counts` says how many students started each exercise, in any group: what
--   warns before changing the tests of an exercise somebody already did.

-- Parameters -------------------------------------------------------------------------------------

-- Whether `names` are distinct plain identifiers, as the check of `function_name` asks.
create function public.are_valid_parameters(names text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(name ~ '^[A-Za-z_$][A-Za-z0-9_$]*$'), true)
    and count(distinct name) = count(*)
  from unnest(names) as names_list (name)
$$;

alter table public.exercise
add column parameters text[] not null default '{}'
constraint exercise_parameters_check check (public.are_valid_parameters(parameters));

grant update (parameters) on public.exercise to authenticated;

-- Authors -----------------------------------------------------------------------------------------

-- Whether the user may change or delete the exercise: its author or the administration.
create function public.can_edit_exercise(target_exercise_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.exercise
    where id = target_exercise_id and created_by = (select auth.uid())
      and public.is_staff()
  );
$$;

revoke execute on function public.can_edit_exercise(uuid) from public, anon;
grant execute on function public.can_edit_exercise(uuid) to authenticated;

drop policy "Staff edit exercises" on public.exercise;
drop policy "Staff delete exercises" on public.exercise;

create policy "Authors and admins edit exercises"
on public.exercise for update to authenticated
using (public.can_edit_exercise(id))
with check (public.can_edit_exercise(id));

create policy "Authors and admins delete exercises"
on public.exercise for delete to authenticated
using (public.can_edit_exercise(id));

drop policy "Staff manage tests" on public.test;

create policy "Authors and admins manage tests"
on public.test for all to authenticated
using (public.can_edit_exercise(exercise_id))
with check (public.can_edit_exercise(exercise_id));

drop policy "Staff manage the subjects of the exercises" on public.exercise_subject;

create policy "Authors and admins manage the subjects of the exercises"
on public.exercise_subject for all to authenticated
using (public.can_edit_exercise(exercise_id))
with check (public.can_edit_exercise(exercise_id));

-- Saving ------------------------------------------------------------------------------------------

-- Creates the exercise (without `target_exercise_id`) or changes it, and replaces its tests and its
-- subjects, in one transaction. Security invoker: the RLS decides, so another teacher's exercise
-- is not found. `fields` carries the columns the teacher edits; `tests`, a list of
-- `{input, expected_output, is_hidden}` in their order.
create function public.save_exercise(
  target_exercise_id uuid,
  fields jsonb,
  tests jsonb,
  subject_ids uuid[]
)
returns public.exercise
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved public.exercise;
begin
  if not public.is_staff() then
    raise exception 'Only teachers save exercises' using errcode = '42501';
  end if;
  if jsonb_typeof(tests) <> 'array' or jsonb_array_length(tests) = 0 then
    raise exception 'An exercise needs at least one test' using errcode = 'P0001';
  end if;

  if target_exercise_id is null then
    insert into public.exercise (
      title, statement, difficulty, topics, source_locale, translations, function_name,
      parameters, max_repeated_failures, max_idle_minutes, created_by
    )
    values (
      fields ->> 'title',
      fields ->> 'statement',
      (fields ->> 'difficulty')::public.difficulty,
      array(select jsonb_array_elements_text(fields -> 'topics')),
      (fields ->> 'source_locale')::public.app_locale,
      fields -> 'translations',
      fields ->> 'function_name',
      array(select jsonb_array_elements_text(fields -> 'parameters')),
      (fields ->> 'max_repeated_failures')::integer,
      (fields ->> 'max_idle_minutes')::integer,
      (select auth.uid())
    )
    returning * into saved;
  else
    update public.exercise set
      title = fields ->> 'title',
      statement = fields ->> 'statement',
      difficulty = (fields ->> 'difficulty')::public.difficulty,
      topics = array(select jsonb_array_elements_text(fields -> 'topics')),
      source_locale = (fields ->> 'source_locale')::public.app_locale,
      translations = fields -> 'translations',
      function_name = fields ->> 'function_name',
      parameters = array(select jsonb_array_elements_text(fields -> 'parameters')),
      max_repeated_failures = (fields ->> 'max_repeated_failures')::integer,
      max_idle_minutes = (fields ->> 'max_idle_minutes')::integer
    where id = target_exercise_id
    returning * into saved;
    if saved.id is null then
      raise exception 'Exercise not found' using errcode = 'P0002';
    end if;
    delete from public.test where exercise_id = saved.id;
    delete from public.exercise_subject where exercise_id = saved.id;
  end if;

  insert into public.test (exercise_id, input, expected_output, is_hidden, position)
  select saved.id, test -> 'input', test -> 'expected_output',
    coalesce((test ->> 'is_hidden')::boolean, false), (ordinality - 1)::integer
  from jsonb_array_elements(tests) with ordinality as each_test (test, ordinality);

  insert into public.exercise_subject (exercise_id, subject_id)
  select saved.id, subject_id from unnest(subject_ids) as each_subject (subject_id);

  return saved;
end;
$$;

revoke execute on function public.save_exercise(uuid, jsonb, jsonb, uuid[]) from public, anon;
grant execute on function public.save_exercise(uuid, jsonb, jsonb, uuid[]) to authenticated;

-- Use ---------------------------------------------------------------------------------------------

-- How many students started each exercise, in any group: teachers only read the attempts of their
-- students, but the warning is about everybody. Only counts, never who.
create function public.exercise_student_counts()
returns table (exercise_id uuid, student_count integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Only teachers read the use of the bank' using errcode = '42501';
  end if;
  return query
  select a.exercise_id, count(distinct a.user_id)::integer
  from public.attempt a
  group by a.exercise_id;
end;
$$;

revoke execute on function public.exercise_student_counts() from public, anon;
grant execute on function public.exercise_student_counts() to authenticated;
