-- Step 2.3 · What the Edge Function `execute` keeps of a run (docs/PLAN.md §2.4 and §2.8): the code
-- it ran, the status that code earned and the `run` event, all or nothing. Only the server calls it,
-- with `service_role`, after checking that the attempt belongs to the caller.

create function public.record_run(
  target_attempt_id uuid,
  ran_code text,
  new_status public.attempt_status,
  run_detail jsonb
)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  previous_status public.attempt_status;
begin
  if new_status not in ('tests_failed', 'passed') then
    raise exception 'A run only fails or passes' using errcode = 'P0001';
  end if;

  select status into previous_status from public.attempt where id = target_attempt_id for update;
  if previous_status is null then
    raise exception 'Attempt not found' using errcode = 'P0002';
  end if;
  if previous_status = 'submitted' then
    raise exception 'A submitted attempt cannot run again' using errcode = 'P0001';
  end if;

  -- First the code and then its status: in one update, a run that repeats the previous status with
  -- new code would look like an edit to the trigger `attempt_code_changed`, which would undo it.
  update public.attempt set current_code = ran_code where id = target_attempt_id;
  update public.attempt set status = new_status where id = target_attempt_id;

  insert into public.process_event (attempt_id, type, timestamp, detail)
  values (target_attempt_id, 'run', now(), run_detail);
end;
$$;

revoke execute on function public.record_run(uuid, text, public.attempt_status, jsonb)
from public, anon, authenticated;
grant execute on function public.record_run(uuid, text, public.attempt_status, jsonb)
to service_role;

-- The limit of runs per minute and user counts these events: an index keeps it cheap.
create index process_event_run_received_at_idx on public.process_event (received_at)
where type = 'run';
