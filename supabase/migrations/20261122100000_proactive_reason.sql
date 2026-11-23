-- Step 6.2c · Why the tutor stepped in (docs/PLAN.md 2.7 and 2.8, D-065): the event
-- `proactive_intervention` keeps the reason that the Edge Function `tutor` checked, and only an
-- intervention has one. The events of a request take the time it arrived, not that of the answer of
-- the model, up to 30 s later: a run made meanwhile comes after the intervention, as the browser
-- counts it, and opens the next episode of failures on both sides (D-090).

-- The same function as in step 2.5e, with the reason and the time of the request at the end: the
-- signature changes, so the old one goes.
drop function public.record_tutor_interaction(
  uuid, uuid, public.tutor_trigger, smallint, text, text, public.emotion, smallint, boolean, text,
  text, boolean, smallint, jsonb
);

-- The answer and its process event (`hint_requested` or `proactive_intervention`), all or nothing.
-- An intervention the model chose not to make keeps only its event, and returns null.
create function public.record_tutor_interaction(
  target_attempt_id uuid,
  target_request_id uuid,
  asked_trigger public.tutor_trigger,
  answer_hint_level smallint,
  asked_message text,
  answer_transcript text,
  answer_emotion public.emotion,
  answer_intensity smallint,
  answer_elusion boolean,
  answer_prompt_version text,
  answer_model text,
  answer_silent boolean,
  answer_rejected smallint default 0,
  answer_actions jsonb default '[]'::jsonb,
  answer_reason text default null,
  asked_at timestamptz default null
)
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  current_status public.attempt_status;
  interaction_id uuid;
  -- Never later than now; without it, now (`least` skips the null)
  event_at constant timestamptz := least(asked_at, now());
begin
  if answer_silent and asked_trigger <> 'proactive' then
    raise exception 'Only an intervention of the tutor may keep quiet' using errcode = 'P0001';
  end if;
  if (asked_trigger = 'proactive') <> (answer_reason is not null) then
    raise exception 'Only an intervention of the tutor has a reason, and it needs one'
      using errcode = '22023';
  end if;
  if answer_reason not in ('failures', 'idle', 'achievement') then
    raise exception 'Unknown reason of an intervention: %', answer_reason using errcode = '22023';
  end if;

  select status into current_status from public.attempt where id = target_attempt_id for update;
  if current_status is null then
    raise exception 'Attempt not found' using errcode = 'P0002';
  end if;
  if current_status = 'submitted' then
    raise exception 'A submitted attempt gets no more help' using errcode = 'P0001';
  end if;

  if not answer_silent then
    insert into public.tutor_interaction (
      attempt_id, request_id, trigger, hint_level, student_message, transcript, emotion, intensity,
      elusion, prompt_version, model, rejected_answers, actions
    )
    values (
      target_attempt_id, target_request_id, asked_trigger, answer_hint_level, asked_message,
      answer_transcript, answer_emotion, answer_intensity, answer_elusion, answer_prompt_version,
      answer_model, answer_rejected, answer_actions
    )
    returning id into interaction_id;
  end if;

  if asked_trigger = 'hint' then
    insert into public.process_event (attempt_id, type, timestamp, detail)
    values (target_attempt_id, 'hint_requested', event_at, jsonb_build_object('level', answer_hint_level));
  elsif asked_trigger = 'proactive' then
    insert into public.process_event (attempt_id, type, timestamp, detail)
    values (
      target_attempt_id, 'proactive_intervention', event_at,
      jsonb_build_object('silent', answer_silent, 'reason', answer_reason)
    );
  end if;

  return interaction_id;
end;
$$;

revoke execute on function public.record_tutor_interaction(
  uuid, uuid, public.tutor_trigger, smallint, text, text, public.emotion, smallint, boolean, text,
  text, boolean, smallint, jsonb, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.record_tutor_interaction(
  uuid, uuid, public.tutor_trigger, smallint, text, text, public.emotion, smallint, boolean, text,
  text, boolean, smallint, jsonb, text, timestamptz
) to service_role;
