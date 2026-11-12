-- Step 2.5e · What the tutor did in each answer with its tools (docs/PLAN.md 2.5e, D-051): the
-- calls to the actions of the contract that the Edge Function `tutor` checked, as a list of
-- { name, arguments }. The chat shows them again with the conversation, without running them, and
-- the teacher can see them. The queries are not kept: their results are the student's own data.
alter table public.tutor_interaction
add column actions jsonb not null default '[]'::jsonb
constraint tutor_interaction_actions_list check (jsonb_typeof(actions) = 'array');

-- The same function as in step 2.5, with the actions at the end: the signature changes, so the old
-- one goes.
drop function public.record_tutor_interaction(
  uuid, uuid, public.tutor_trigger, smallint, text, text, public.emotion, smallint, boolean, text,
  text, boolean, smallint
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
  answer_actions jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  current_status public.attempt_status;
  interaction_id uuid;
begin
  if answer_silent and asked_trigger <> 'proactive' then
    raise exception 'Only an intervention of the tutor may keep quiet' using errcode = 'P0001';
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
    values (target_attempt_id, 'hint_requested', now(), jsonb_build_object('level', answer_hint_level));
  elsif asked_trigger = 'proactive' then
    insert into public.process_event (attempt_id, type, timestamp, detail)
    values (target_attempt_id, 'proactive_intervention', now(), jsonb_build_object('silent', answer_silent));
  end if;

  return interaction_id;
end;
$$;

revoke execute on function public.record_tutor_interaction(
  uuid, uuid, public.tutor_trigger, smallint, text, text, public.emotion, smallint, boolean, text,
  text, boolean, smallint, jsonb
) from public, anon, authenticated;
grant execute on function public.record_tutor_interaction(
  uuid, uuid, public.tutor_trigger, smallint, text, text, public.emotion, smallint, boolean, text,
  text, boolean, smallint, jsonb
) to service_role;
