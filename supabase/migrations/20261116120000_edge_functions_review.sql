-- Security review of the Edge Functions (docs/PLAN.md §2.3 and §2.4, D-063): what a signed-in user
-- could still do by calling `execute`, `tutor` and `translate` directly.
--
-- - A run and a turn of the tutor are counted before they happen, one at a time: requests at once
--   no longer pass the limit together, and what fails or kills the function counts too.
-- - The data the tutor asks the app for are only taken for a query it made.
-- - An attempt is worked on while its assignment is visible and its student enrolled.
-- - The requests of the staff have a limit per day too.
-- - The setting of the AI provider has the shape of one: a URL of the web and few fallbacks.

-- The turns of a student ---------------------------------------------------------------------------

-- Until now `execute` counted the `run` events and `tutor` its recorded answers, read before
-- running and written after: thirty requests at once read the same count and all passed, and a run
-- that killed the function, a turn the provider failed or one where the model asked for data left
-- nothing to count. Now each takes its turn first, as the staff does (D-059). Only when and of
-- what kind.
create type public.student_request_kind as enum ('run', 'tutor');

create table public.student_request (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.app_user (id) on delete cascade,
  kind public.student_request_kind not null,
  received_at timestamptz not null default now()
);

create index student_request_user_id_kind_received_at_idx
on public.student_request (user_id, kind, received_at desc);

-- No policy: only the Edge Functions read and write it, with `service_role`.
alter table public.student_request enable row level security;
revoke all on public.student_request from anon, authenticated;

-- Takes one request of `request_kind` for the user if they have made fewer than `per_minute` in the
-- last minute and, with `per_day`, fewer than that in the last 24 hours: then it records it and
-- answers 0. Otherwise it records nothing and answers the seconds until the oldest of them leaves
-- its window. A lock per user and kind makes two requests at once count one after the other. What
-- is older than a day counts for nothing, and goes.
create function public.claim_student_request(
  target_user_id uuid,
  request_kind public.student_request_kind,
  per_minute integer,
  per_day integer default null
)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  oldest timestamptz;
begin
  perform pg_advisory_xact_lock(
    hashtext('student_request:' || target_user_id::text || request_kind::text)
  );

  delete from public.student_request
  where user_id = target_user_id and kind = request_kind
    and received_at <= now() - interval '1 day';

  select received_at into oldest
  from public.student_request
  where user_id = target_user_id and kind = request_kind
    and received_at > now() - interval '1 minute'
  order by received_at desc
  offset per_minute - 1
  limit 1;

  if oldest is not null then
    return greatest(1, ceil(extract(epoch from oldest + interval '1 minute' - now()))::integer);
  end if;

  if per_day is not null then
    select received_at into oldest
    from public.student_request
    where user_id = target_user_id and kind = request_kind
    order by received_at desc
    offset per_day - 1
    limit 1;

    if oldest is not null then
      return greatest(1, ceil(extract(epoch from oldest + interval '1 day' - now()))::integer);
    end if;
  end if;

  insert into public.student_request (user_id, kind) values (target_user_id, request_kind);
  return 0;
end;
$$;

revoke execute on function public.claim_student_request(
  uuid, public.student_request_kind, integer, integer
) from public, anon, authenticated;
grant execute on function public.claim_student_request(
  uuid, public.student_request_kind, integer, integer
) to service_role;

-- `tutor` read its limit here: the turns are counted above now.
drop function public.latest_tutor_calls(uuid, timestamptz, integer);

-- The requests of the staff, per day too -------------------------------------------------------------

-- A draft of a translation and a turn of the tutor in preview call the model: with a limit per
-- minute only, one account of a teacher could spend the quota of the day of the whole project.
drop function public.claim_staff_request(uuid, public.staff_request_kind, integer);

create function public.claim_staff_request(
  target_user_id uuid,
  request_kind public.staff_request_kind,
  per_minute integer,
  per_day integer default null
)
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  oldest timestamptz;
begin
  if not exists (
    select 1 from public.app_user
    where id = target_user_id and role in ('teacher', 'admin') and status = 'active'
  ) then
    raise exception 'Only an active teacher or administrator' using errcode = 'P0003';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_user_id::text || request_kind::text));

  delete from public.staff_request
  where user_id = target_user_id and kind = request_kind
    and received_at <= now() - interval '1 day';

  select received_at into oldest
  from public.staff_request
  where user_id = target_user_id and kind = request_kind
    and received_at > now() - interval '1 minute'
  order by received_at desc
  offset per_minute - 1
  limit 1;

  if oldest is not null then
    return greatest(1, ceil(extract(epoch from oldest + interval '1 minute' - now()))::integer);
  end if;

  if per_day is not null then
    select received_at into oldest
    from public.staff_request
    where user_id = target_user_id and kind = request_kind
    order by received_at desc
    offset per_day - 1
    limit 1;

    if oldest is not null then
      return greatest(1, ceil(extract(epoch from oldest + interval '1 day' - now()))::integer);
    end if;
  end if;

  insert into public.staff_request (user_id, kind) values (target_user_id, request_kind);
  return 0;
end;
$$;

revoke execute on function public.claim_staff_request(
  uuid, public.staff_request_kind, integer, integer
) from public, anon, authenticated;
grant execute on function public.claim_staff_request(
  uuid, public.staff_request_kind, integer, integer
) to service_role;

-- The queries the tutor waits for ------------------------------------------------------------------

-- When the model needs data of the student (2.5e), the app reads them and sends the same request
-- again with them. `tutor` took any results, also those of a query it never made: a way to hand
-- the model 12 000 characters as if they were data it had asked for. Now it keeps what it asked,
-- and the results are taken once, for that request, of that user and for a while.
create table public.tutor_pending_query (
  request_id uuid primary key,
  user_id uuid not null references public.app_user (id) on delete cascade,
  calls jsonb not null,
  asked_at timestamptz not null default now()
);

create index tutor_pending_query_user_id_idx on public.tutor_pending_query (user_id);

-- No policy: only `tutor` reads and writes it, with `service_role`.
alter table public.tutor_pending_query enable row level security;
revoke all on public.tutor_pending_query from anon, authenticated;

-- Keeps the queries the model asked for in a request, and drops those the user never answered. A
-- request id another user already has is left alone.
create function public.keep_tutor_queries(
  target_request_id uuid,
  target_user_id uuid,
  asked_calls jsonb
)
returns void
language sql
volatile
set search_path = ''
as $$
  delete from public.tutor_pending_query
  where user_id = target_user_id and asked_at <= now() - interval '10 minutes';

  insert into public.tutor_pending_query (request_id, user_id, calls)
  values (target_request_id, target_user_id, asked_calls)
  on conflict (request_id) do update
  set calls = excluded.calls, asked_at = now()
  where tutor_pending_query.user_id = excluded.user_id;
$$;

-- The queries the request waits for, taken: they are answered once. Null if it waits for none.
create function public.take_tutor_queries(target_request_id uuid, target_user_id uuid)
returns jsonb
language sql
volatile
set search_path = ''
as $$
  delete from public.tutor_pending_query
  where request_id = target_request_id and user_id = target_user_id
    and asked_at > now() - interval '10 minutes'
  returning calls;
$$;

revoke execute on function public.keep_tutor_queries(uuid, uuid, jsonb)
from public, anon, authenticated;
grant execute on function public.keep_tutor_queries(uuid, uuid, jsonb) to service_role;

revoke execute on function public.take_tutor_queries(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.take_tutor_queries(uuid, uuid) to service_role;

-- An attempt is worked on while its assignment is open ---------------------------------------------

-- `execute` and `tutor` only checked that the attempt was the caller's, with `service_role`: with
-- its block hidden or not open yet, or its student out of the group, the attempt kept running code
-- and spending the tutor, which the policies would no longer let it open. The attempt can be
-- worked on: its student is still enrolled in the group of its assignment, and sees it. One left
-- without assignment (its group was deleted) cannot.
create function public.is_open_attempt(target_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.attempt t
    join public.exercise_assignment a on a.id = t.assignment_id
    join public.enrollment e on e.group_id = a.group_id and e.user_id = t.user_id
    where t.id = target_attempt_id and public.is_visible_assignment(a.id)
  );
$$;

revoke execute on function public.is_open_attempt(uuid) from public, anon, authenticated;
grant execute on function public.is_open_attempt(uuid) to service_role;

-- The setting of the AI provider -------------------------------------------------------------------

-- `app_setting.ai_provider` says where the key of the AI travels, and took any JSON: also
-- `file:///…`, or a hundred fallbacks to try one after another. The Edge Functions only call the
-- hosts they allow (`_shared/provider-setting.ts`), which is what keeps the key; this is the shape,
-- so a wrong setting fails when it is written and not when a student asks. The main model has a URL
-- of the web and a name, and up to five fallbacks, each the name of a model or an object with a URL
-- of the web if it has one.
create function public.is_valid_ai_provider(setting jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  web_url constant text := '^https?://[^/[:space:]]+';
  fallback jsonb;
begin
  if jsonb_typeof(setting) <> 'object'
    or jsonb_typeof(setting -> 'baseUrl') is distinct from 'string'
    or setting ->> 'baseUrl' !~ web_url
    or jsonb_typeof(setting -> 'model') is distinct from 'string'
    or btrim(setting ->> 'model') = ''
  then
    return false;
  end if;
  if not setting ? 'fallbacks' then
    return true;
  end if;
  if jsonb_typeof(setting -> 'fallbacks') <> 'array'
    or jsonb_array_length(setting -> 'fallbacks') > 5
  then
    return false;
  end if;
  for fallback in select * from jsonb_array_elements(setting -> 'fallbacks') loop
    if jsonb_typeof(fallback) not in ('string', 'object') then
      return false;
    end if;
    if jsonb_typeof(fallback) = 'object' and fallback ? 'baseUrl' and (
      jsonb_typeof(fallback -> 'baseUrl') <> 'string' or fallback ->> 'baseUrl' !~ web_url
    ) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

-- The check below runs it as whoever writes the row: the administration.
revoke execute on function public.is_valid_ai_provider(jsonb) from public, anon;
grant execute on function public.is_valid_ai_provider(jsonb) to authenticated;

alter table public.app_setting
add constraint app_setting_ai_provider check (
  key <> 'ai_provider' or public.is_valid_ai_provider(value)
);
