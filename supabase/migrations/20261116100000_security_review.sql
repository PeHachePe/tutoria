-- Security review of the database (docs/PLAN.md §2.3 and §2.10, D-062): what a signed-in user could
-- still do by calling the API directly, outside what the screens do.
--
-- - No function is left open to visitors who are not signed in.
-- - A teacher reads the attempts at the assignments of their groups, not everything their students
--   do in the groups of other teachers.
-- - What the browser writes has a limit: the code of an attempt and its events.
-- - The data notice is accepted once, with the time of the server.
-- - An assignment keeps its exercise and its group; a block, its group.
-- - Only the students of a group open attempts at its assignments.
-- - An exercise assigned in the groups of other teachers is not deleted by its author.

-- Functions open to anybody -----------------------------------------------------------------------

-- `alter default privileges in schema public revoke execute on functions from public` (2.1) takes
-- nothing away: the permission of PUBLIC is a global default of the role, which also reaches the
-- extensions it installs, so it stays. Each migration revokes it function by function, and
-- `function_privileges.test.sql` fails if one forgets. These three were the only ones forgotten:
-- the checks of the tables run them as whoever writes the row.
revoke execute on function
  public.is_valid_exercise_translations(jsonb, public.app_locale),
  public.is_valid_text_translations(jsonb, public.app_locale, text),
  public.are_valid_parameters(text[])
from public, anon;

grant execute on function
  public.is_valid_exercise_translations(jsonb, public.app_locale),
  public.is_valid_text_translations(jsonb, public.app_locale, text),
  public.are_valid_parameters(text[])
to authenticated;

-- A teacher reads the attempts of their groups -----------------------------------------------------

-- The assignment is of a group the signed-in teacher teaches.
create function public.teaches_assignment(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.exercise_assignment a
    where a.id = target_assignment_id and public.teaches_group(a.group_id)
  );
$$;

revoke execute on function public.teaches_assignment(uuid) from public, anon;
grant execute on function public.teaches_assignment(uuid) to authenticated;

-- Until now, `teaches_student(user_id)`: a student enrolled in the groups of two teachers showed
-- each of them the code, the events and the messages to the tutor of the subject of the other. An
-- attempt left without assignment (its group was deleted) is only read by its student and by the
-- administration.
drop policy "Users read their attempts; teachers, their students'" on public.attempt;

create policy "Users read their attempts; teachers, those of their groups"
on public.attempt for select to authenticated
using (
  (user_id = (select auth.uid()) and public.current_app_role() is not null)
  or public.is_admin()
  or public.teaches_assignment(assignment_id)
);

-- The attempt is the user's own, one of a group they teach or they are an administrator. The
-- policies of `tutor_interaction` and `process_event` read through it.
create or replace function public.can_read_attempt(target_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.attempt
    where id = target_attempt_id
      and (
        (user_id = (select auth.uid()) and public.current_app_role() is not null)
        or public.is_admin()
        or public.teaches_assignment(assignment_id)
      )
  );
$$;

-- Limits to what the browser writes ---------------------------------------------------------------

-- The Edge Functions take no more than MAX_CODE_LENGTH (supabase/functions/_shared/limits.ts), but
-- the browser saves the code straight into the table, which took any size. JavaScript counts
-- UTF-16 units and Postgres characters, never more: what the functions accept, the table does.
alter table public.attempt
add constraint attempt_current_code_length check (char_length(current_code) <= 50000);

-- The events only the browser knows, which it inserts itself (§2.8).
create function public.is_browser_event(event_type public.process_event_type)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select event_type in ('paste', 'focus_lost', 'focus_gained');
$$;

-- The check below and the policy run it as whoever inserts the event.
revoke execute on function public.is_browser_event(public.process_event_type) from public, anon;
grant execute on function public.is_browser_event(public.process_event_type) to authenticated;

drop policy "Students record browser events in their open attempts" on public.process_event;

create policy "Students record browser events in their open attempts"
on public.process_event for insert to authenticated
with check (public.is_browser_event(type) and public.can_record_event(attempt_id));

-- Their detail is a number at most (`{"length": 12}`, `{"awayMs": 5300}`): the live panel loads
-- every event of every attempt of a block, so a big one would reach every teacher watching.
alter table public.process_event
add constraint process_event_browser_detail_size check (
  not public.is_browser_event(type) or octet_length(detail::text) <= 100
);

-- The browser says when its events happened, and its clock may be wrong or lie: the time is kept
-- between the opening of the attempt and the arrival of the event. Security invoker: a student
-- reads their own attempts, and the policy rejects the events in those of others.
create function public.process_event_bound_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  opened_at timestamptz;
begin
  select started_at into opened_at from public.attempt where id = new.attempt_id;
  new.timestamp := least(greatest(new.timestamp, opened_at), new.received_at);
  return new;
end;
$$;

revoke execute on function public.process_event_bound_timestamp()
from public, anon, authenticated;

create trigger process_event_bound_timestamp
before insert on public.process_event
for each row when (public.is_browser_event(new.type))
execute function public.process_event_bound_timestamp();

-- How many browser events an attempt takes, per minute and in all: far more than a student makes
-- changing of window or pasting (the app sends them in batches of 20), and few enough for one
-- request not to flood the live panel, which gets each of them by Realtime, nor fill the database.
-- Once per statement, after it: a batch that goes over is rejected whole (P0001, `invalid`, which
-- the app does not send again). A lock per attempt makes two requests at once count one after the
-- other. Security definer: it counts without the policies, row by row.
create function public.process_event_browser_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_per_minute constant integer := 300;
  max_per_attempt constant integer := 3000;
  target_attempt_id uuid;
begin
  for target_attempt_id in
    select distinct attempt_id from inserted
    where public.is_browser_event(type)
    -- Always in the same order, so two requests never wait for each other
    order by attempt_id
  loop
    perform pg_advisory_xact_lock(hashtext('process_event:' || target_attempt_id::text));

    if (
      select count(*) > max_per_attempt
        or count(*) filter (where received_at > now() - interval '1 minute') > max_per_minute
      from public.process_event
      where attempt_id = target_attempt_id and public.is_browser_event(type)
    ) then
      raise exception 'Too many browser events in the attempt' using errcode = 'P0001';
    end if;
  end loop;
  return null;
end;
$$;

revoke execute on function public.process_event_browser_limits()
from public, anon, authenticated;

create trigger process_event_browser_limits
after insert on public.process_event
referencing new table as inserted
for each statement execute function public.process_event_browser_limits();

-- The data notice, accepted once -------------------------------------------------------------------

-- `privacy_notice_seen_at` is the proof that the user was informed (GDPR art. 13), and its owner
-- could write any date in it, or empty it. From the browser it only goes from empty to now, with the
-- clock of the server; accepting it again changes nothing. The server (`service_role`) still writes
-- it freely, to ask for it again when the notice changes.
create function public.app_user_privacy_notice_seen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if old.privacy_notice_seen_at is not null then
      new.privacy_notice_seen_at := old.privacy_notice_seen_at;
    elsif new.privacy_notice_seen_at is not null then
      new.privacy_notice_seen_at := now();
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.app_user_privacy_notice_seen()
from public, anon, authenticated;

create trigger app_user_privacy_notice_seen
before update of privacy_notice_seen_at on public.app_user
for each row execute function public.app_user_privacy_notice_seen();

-- What a teacher changes of an assignment and of a block -------------------------------------------

-- With the whole row, a teacher could point an assignment with attempts to another exercise, and
-- the attempts would be of an exercise that is not theirs. Only what the screen changes: the
-- assignment moves to another block (`move_assignment`), is reordered, hidden and given a due date.
revoke update on public.exercise_assignment from authenticated;
grant update (block_id, position, is_hidden, due_at) on public.exercise_assignment to authenticated;

-- A block never changes of group.
revoke update on public.class_block from authenticated;
grant update (position, title, source_locale, translations, is_hidden, opens_at)
on public.class_block to authenticated;

-- Only the students of a group open attempts -------------------------------------------------------

-- The teacher of the group and the administration could open attempts at its assignments (2.5c):
-- they counted as one more student, and an assignment «started» that way could not be deleted. Since
-- 4.3e they try an exercise without an attempt (D-061). The signed-in user can open attempts at the
-- assignment: they are enrolled in its group and they see it.
create or replace function public.can_open_assignment(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.exercise_assignment a
    where a.id = target_assignment_id
      and public.is_enrolled(a.group_id)
      and public.is_visible_assignment(a.id)
  );
$$;

-- An exercise other teachers use is not deleted ----------------------------------------------------

-- The exercise is assigned in a group the signed-in user does not manage.
create function public.is_assigned_by_others(target_exercise_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.is_admin() and exists (
    select 1 from public.exercise_assignment a
    where a.exercise_id = target_exercise_id
      and not coalesce(public.teaches_group(a.group_id), false)
  );
$$;

revoke execute on function public.is_assigned_by_others(uuid) from public, anon;
grant execute on function public.is_assigned_by_others(uuid) to authenticated;

-- Deleting an exercise takes its assignments nobody started with it (`on delete cascade`), also
-- those of the blocks of other teachers, who lost them without notice. Its author deletes it only
-- while it is assigned in their own groups; otherwise they archive it (4.3d). 23503, as when its
-- attempts keep it: `invalid` for the app. The server (`service_role`) deletes without this.
create function public.exercise_kept_by_others()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and public.is_assigned_by_others(old.id) then
    raise exception 'The exercise is assigned in the groups of other teachers'
      using errcode = '23503';
  end if;
  return old;
end;
$$;

revoke execute on function public.exercise_kept_by_others() from public, anon, authenticated;

create trigger exercise_kept_by_others
before delete on public.exercise
for each row execute function public.exercise_kept_by_others();
