-- Step 2.4 · What the Edge Function `tutor` keeps of each answer (docs/PLAN.md §2.6 and §2.8). Only
-- the server calls these functions, with `service_role`, after checking that the attempt belongs to
-- the caller.

-- The request the answer belongs to, chosen by the client for each turn: a retry of a request that
-- was recorded gets the same answer back instead of a new one, so the level never rises twice.
alter table public.tutor_interaction add column request_id uuid unique;

-- The model that answered, next to the version of its prompt: the elusion battery (2.5) and the
-- memory compare models with it. Null for the scripted tutor of the seed.
alter table public.tutor_interaction add column model text;

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
  answer_silent boolean
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
      elusion, prompt_version, model
    )
    values (
      target_attempt_id, target_request_id, asked_trigger, answer_hint_level, asked_message,
      answer_transcript, answer_emotion, answer_intensity, answer_elusion, answer_prompt_version,
      answer_model
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
  text, boolean
) from public, anon, authenticated;
grant execute on function public.record_tutor_interaction(
  uuid, uuid, public.tutor_trigger, smallint, text, text, public.emotion, smallint, boolean, text,
  text, boolean
) to service_role;

-- When the user's latest calls to the model since `since` were made, newest first and `max_count`
-- at most, for the limit of calls per minute: every answer, and every intervention the model chose
-- not to make, which also cost a call.
create function public.latest_tutor_calls(target_user_id uuid, since timestamptz, max_count integer)
returns setof timestamptz
language sql
stable
set search_path = ''
as $$
  select called_at from (
    select interaction.created_at as called_at
    from public.tutor_interaction as interaction
    join public.attempt on attempt.id = interaction.attempt_id
    where attempt.user_id = target_user_id and interaction.created_at >= since
    union all
    select event.received_at
    from public.process_event as event
    join public.attempt on attempt.id = event.attempt_id
    where attempt.user_id = target_user_id
      and event.type = 'proactive_intervention'
      and event.detail ->> 'silent' = 'true'
      and event.received_at >= since
  ) as calls
  order by called_at desc
  limit max_count;
$$;

revoke execute on function public.latest_tutor_calls(uuid, timestamptz, integer)
from public, anon, authenticated;
grant execute on function public.latest_tutor_calls(uuid, timestamptz, integer) to service_role;

-- The limit reads the latest answers: an index keeps it cheap.
create index tutor_interaction_created_at_idx on public.tutor_interaction (created_at);
