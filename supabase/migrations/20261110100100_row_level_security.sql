-- Step 2.1 · Who reads and writes what (docs/PLAN.md §2.3). The client is never trusted.
--
-- - Students reach their own rows and the exercises assigned to their groups; of the tests, only
--   the visible ones.
-- - Teachers reach the groups they teach and, through `enrollment`, the attempts and events of
--   their students. The exercise bank is shared by every teacher.
-- - Administrators reach everything.
-- - A disabled user has no role, so no policy lets them in.
--
-- Table privileges say which operations and columns each role may use; policies say which rows.
-- What only the server writes (attempt status, tutor interactions, server events) is done by the
-- RPC of the next migration or by the Edge Functions with `service_role`, which bypasses RLS.

-- Privileges -------------------------------------------------------------------------------------

-- Supabase grants everything to `anon` and `authenticated` by default: start from nothing.
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Users only record that they saw the data notice; everything else in `app_user` changes through
-- the Edge Function `admin-users` (phase 5).
grant select on public.app_user to authenticated;
grant update (privacy_notice_seen_at) on public.app_user to authenticated;

grant select, insert, update, delete on public.class_group to authenticated;
grant select, insert, update, delete on public.enrollment to authenticated;
grant select, insert, update, delete on public.class_session to authenticated;
grant select, insert, delete on public.exercise to authenticated;
grant update (title, statement, difficulty, topics, kind, language, function_name,
  max_repeated_failures, max_idle_minutes) on public.exercise to authenticated;
grant select, insert, update, delete on public.test to authenticated;
grant select, insert, update, delete on public.exercise_assignment to authenticated;

-- Attempts are opened with `open_attempt` and submitted with `submit_attempt`: the client only
-- saves the code.
grant select on public.attempt to authenticated;
grant update (current_code) on public.attempt to authenticated;

grant select on public.tutor_interaction to authenticated;

-- Events are only inserted, never changed; the database sets `id` and `received_at`.
grant select on public.process_event to authenticated;
grant insert (attempt_id, type, timestamp, detail) on public.process_event to authenticated;

grant select, insert, update, delete on public.app_setting to authenticated;

-- Helper functions -------------------------------------------------------------------------------
--
-- `security definer` so policies can look at other tables without recursing into their policies.
-- `stable` and `(select auth.uid())` let Postgres evaluate them once per statement.

-- Role of the signed-in user, or null if they are disabled or not signed in.
create function public.current_app_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.app_user where id = (select auth.uid()) and status = 'active';
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'admin', false);
$$;

-- Teachers and administrators, who share the exercise bank.
create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() in ('teacher', 'admin'), false);
$$;

create function public.teaches_group(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_app_role() = 'teacher' and exists (
    select 1 from public.class_group
    where id = target_group_id and teacher_id = (select auth.uid())
  );
$$;

create function public.is_enrolled(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_app_role() is not null and exists (
    select 1 from public.enrollment
    where group_id = target_group_id and user_id = (select auth.uid())
  );
$$;

-- The student is enrolled in a group the signed-in teacher teaches.
create function public.teaches_student(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_app_role() = 'teacher' and exists (
    select 1 from public.enrollment e
    join public.class_group g on g.id = e.group_id
    where e.user_id = target_user_id and g.teacher_id = (select auth.uid())
  );
$$;

-- The exercise is assigned to a group the signed-in user is enrolled in.
create function public.is_assigned_to_me(target_exercise_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_app_role() is not null and exists (
    select 1 from public.exercise_assignment a
    join public.enrollment e on e.group_id = a.group_id
    where a.exercise_id = target_exercise_id and e.user_id = (select auth.uid())
  );
$$;

-- The attempt is the user's own, one of their students' or they are an administrator.
create function public.can_read_attempt(target_attempt_id uuid)
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
        or public.teaches_student(user_id)
      )
  );
$$;

-- The browser may record an event in the attempt: their own and not submitted.
create function public.can_record_event(target_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_app_role() is not null and exists (
    select 1 from public.attempt
    where id = target_attempt_id and user_id = (select auth.uid()) and status <> 'submitted'
  );
$$;

revoke execute on function
  public.current_app_role(),
  public.is_admin(),
  public.is_staff(),
  public.teaches_group(uuid),
  public.is_enrolled(uuid),
  public.teaches_student(uuid),
  public.is_assigned_to_me(uuid),
  public.can_read_attempt(uuid),
  public.can_record_event(uuid)
from public, anon;

grant execute on function
  public.current_app_role(),
  public.is_admin(),
  public.is_staff(),
  public.teaches_group(uuid),
  public.is_enrolled(uuid),
  public.teaches_student(uuid),
  public.is_assigned_to_me(uuid),
  public.can_read_attempt(uuid),
  public.can_record_event(uuid)
to authenticated;

-- Row level security, on in every table ----------------------------------------------------------

alter table public.app_user enable row level security;
alter table public.class_group enable row level security;
alter table public.enrollment enable row level security;
alter table public.class_session enable row level security;
alter table public.exercise enable row level security;
alter table public.test enable row level security;
alter table public.exercise_assignment enable row level security;
alter table public.attempt enable row level security;
alter table public.tutor_interaction enable row level security;
alter table public.process_event enable row level security;
alter table public.app_setting enable row level security;

-- app_user

create policy "Users read themselves; teachers, their students; admins, all"
on public.app_user for select to authenticated
using (
  (id = (select auth.uid()) and public.current_app_role() is not null)
  or public.is_admin()
  or public.teaches_student(id)
);

create policy "Users record that they saw the data notice"
on public.app_user for update to authenticated
using (id = (select auth.uid()) and public.current_app_role() is not null)
with check (id = (select auth.uid()));

-- class_group

create policy "Members read their groups; admins, all"
on public.class_group for select to authenticated
using (public.is_admin() or public.teaches_group(id) or public.is_enrolled(id));

create policy "Admins manage groups"
on public.class_group for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- enrollment

create policy "Students read their enrollments; teachers, their groups'"
on public.enrollment for select to authenticated
using (
  (user_id = (select auth.uid()) and public.current_app_role() is not null)
  or public.is_admin()
  or public.teaches_group(group_id)
);

create policy "Admins manage enrollments"
on public.enrollment for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- class_session

create policy "Members read the sessions of their groups"
on public.class_session for select to authenticated
using (public.is_admin() or public.teaches_group(group_id) or public.is_enrolled(group_id));

create policy "Teachers manage the sessions of their groups"
on public.class_session for all to authenticated
using (public.is_admin() or public.teaches_group(group_id))
with check (public.is_admin() or public.teaches_group(group_id));

-- exercise: a bank shared by every teacher

create policy "Staff read every exercise; students, those assigned to them"
on public.exercise for select to authenticated
using (public.is_staff() or public.is_assigned_to_me(id));

create policy "Staff create exercises as themselves"
on public.exercise for insert to authenticated
with check (public.is_staff() and created_by = (select auth.uid()));

create policy "Staff edit exercises"
on public.exercise for update to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "Staff delete exercises"
on public.exercise for delete to authenticated
using (public.is_staff());

-- test: students never read the hidden ones

create policy "Staff read every test; students, the visible assigned ones"
on public.test for select to authenticated
using (public.is_staff() or (not is_hidden and public.is_assigned_to_me(exercise_id)));

create policy "Staff manage tests"
on public.test for all to authenticated
using (public.is_staff())
with check (public.is_staff());

-- exercise_assignment

create policy "Members read the assignments of their groups"
on public.exercise_assignment for select to authenticated
using (public.is_admin() or public.teaches_group(group_id) or public.is_enrolled(group_id));

create policy "Teachers manage the assignments of their groups"
on public.exercise_assignment for all to authenticated
using (public.is_admin() or public.teaches_group(group_id))
with check (public.is_admin() or public.teaches_group(group_id));

-- attempt

create policy "Users read their attempts; teachers, their students'"
on public.attempt for select to authenticated
using (
  (user_id = (select auth.uid()) and public.current_app_role() is not null)
  or public.is_admin()
  or public.teaches_student(user_id)
);

-- Only `current_code` (column privilege); a submitted attempt rejects it (next migration).
create policy "Users save the code of their attempts"
on public.attempt for update to authenticated
using (user_id = (select auth.uid()) and public.current_app_role() is not null)
with check (user_id = (select auth.uid()));

-- tutor_interaction: written only by the server

create policy "Readers of an attempt read its interactions"
on public.tutor_interaction for select to authenticated
using (public.can_read_attempt(attempt_id));

-- process_event

create policy "Readers of an attempt read its events"
on public.process_event for select to authenticated
using (public.can_read_attempt(attempt_id));

-- Only what the browser alone knows (§2.8); the server records the rest.
create policy "Students record browser events in their open attempts"
on public.process_event for insert to authenticated
with check (
  type in ('paste', 'focus_lost', 'focus_gained')
  and public.can_record_event(attempt_id)
);

-- app_setting

create policy "Admins manage the settings"
on public.app_setting for all to authenticated
using (public.is_admin())
with check (public.is_admin());
