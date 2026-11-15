-- Step 4.3c · The requests of the staff to the Edge Functions (docs/PLAN.md §2.3, D-059): a teacher
-- checks their solution against the tests of the form (`execute`, without an attempt) or asks for
-- the draft of a translation (`translate`). Neither is a run of a student nor a tutor interaction,
-- so their limit per minute counts these rows. Only when and of what kind: never the code or the
-- texts, so the teacher's solution is kept nowhere.

create type public.staff_request_kind as enum ('check', 'translate');

create table public.staff_request (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.app_user (id) on delete cascade,
  kind public.staff_request_kind not null,
  received_at timestamptz not null default now()
);

create index staff_request_user_id_kind_received_at_idx
on public.staff_request (user_id, kind, received_at desc);

-- No policy: only the Edge Functions read and write it, with `service_role`.
alter table public.staff_request enable row level security;
revoke all on public.staff_request from anon, authenticated;

-- Takes one request of `request_kind` for the user if they are an active teacher or administrator
-- and have made fewer than `per_minute` in the last minute: then it records it and answers 0.
-- Otherwise it records nothing and answers the seconds until the oldest of them leaves the minute.
-- A lock per user and kind makes two requests at once count one after the other. Raises P0003 for
-- anyone else: a student, a disabled account or a user that does not exist.
create function public.claim_staff_request(
  target_user_id uuid,
  request_kind public.staff_request_kind,
  per_minute integer
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

  insert into public.staff_request (user_id, kind) values (target_user_id, request_kind);
  return 0;
end;
$$;

revoke execute on function public.claim_staff_request(uuid, public.staff_request_kind, integer)
from public, anon, authenticated;
grant execute on function public.claim_staff_request(uuid, public.staff_request_kind, integer)
to service_role;
