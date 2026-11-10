-- Step 2.1 · Transitions of an attempt (docs/PLAN.md §2.4). Only the server writes the status:
-- this trigger and these functions, and the Edge Function `execute` (step 2.3).
--
-- Errors carry a SQLSTATE the Supabase services translate into a `DataError` (step 2.2):
-- `P0002` (no_data_found) is `not_found` and `P0001` (raise_exception) is `invalid`.

-- Editing the code invalidates the last run -----------------------------------------------------

-- Back to `in_progress` when the code really changes after a run, unless the same update sets the
-- status (the Edge Function `execute` saves the code it ran with its result). A submitted attempt is
-- final: without this, a student could «unsubmit» it with an update of `current_code`.
create function public.attempt_code_changed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.current_code is distinct from old.current_code then
    if old.status = 'submitted' then
      raise exception 'A submitted attempt cannot change' using errcode = 'P0001';
    end if;
    if new.status = old.status and old.status in ('tests_failed', 'passed') then
      new.status := 'in_progress';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.attempt_code_changed() from public, anon, authenticated;

create trigger attempt_code_changed
before update on public.attempt
for each row execute function public.attempt_code_changed();

-- open_attempt ----------------------------------------------------------------------------------

-- The attempt of the signed-in user at the exercise, created on first opening. Students can only
-- open the exercises assigned to their groups; staff can try any of them (without an assignment).
-- Two tabs at once get the same attempt, thanks to the unique (user_id, exercise_id).
create function public.open_attempt(target_exercise_id uuid)
returns public.attempt
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_role public.user_role := public.current_app_role();
  found_assignment_id uuid;
  result public.attempt;
begin
  if caller_role is null or not exists (select 1 from public.exercise where id = target_exercise_id) then
    raise exception 'Exercise not found' using errcode = 'P0002';
  end if;

  select a.id into found_assignment_id
  from public.exercise_assignment a
  join public.enrollment e on e.group_id = a.group_id
  where a.exercise_id = target_exercise_id and e.user_id = (select auth.uid())
  order by a.session, a.id
  limit 1;

  if caller_role = 'student' and found_assignment_id is null then
    raise exception 'Exercise not found' using errcode = 'P0002';
  end if;

  insert into public.attempt (exercise_id, user_id, assignment_id)
  values (target_exercise_id, (select auth.uid()), found_assignment_id)
  on conflict (user_id, exercise_id) do nothing;

  select * into result
  from public.attempt
  where user_id = (select auth.uid()) and exercise_id = target_exercise_id;
  return result;
end;
$$;

-- submit_attempt --------------------------------------------------------------------------------

-- From `passed` to `submitted`, freezing the code, and records the `submit` event (§2.8).
create function public.submit_attempt(target_attempt_id uuid)
returns public.attempt
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  result public.attempt;
begin
  if public.current_app_role() is null or not exists (
    select 1 from public.attempt
    where id = target_attempt_id and user_id = (select auth.uid())
  ) then
    raise exception 'Attempt not found' using errcode = 'P0002';
  end if;

  update public.attempt
  set status = 'submitted', final_code = current_code, finished_at = now()
  where id = target_attempt_id and status = 'passed'
  returning * into result;

  if result.id is null then
    raise exception 'Only a passed attempt can be submitted' using errcode = 'P0001';
  end if;

  insert into public.process_event (attempt_id, type, timestamp, detail)
  values (target_attempt_id, 'submit', result.finished_at, 'null'::jsonb);
  return result;
end;
$$;

revoke execute on function
  public.open_attempt(uuid),
  public.submit_attempt(uuid)
from public, anon;

grant execute on function
  public.open_attempt(uuid),
  public.submit_attempt(uuid)
to authenticated;
