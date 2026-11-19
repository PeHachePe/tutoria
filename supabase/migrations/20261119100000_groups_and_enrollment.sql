-- Step 5.2a · Teachers manage their groups and enrollment (docs/PLAN.md §2.3, RF-16, D-072).
-- The administrator manages every group and chooses its teacher; a teacher creates groups of their
-- own and enrolls in them the students they want. A group never changes subject and is only deleted
-- while nobody has started anything in it, as the blocks (D-058).

-- Searching without accents, as the mock service does.
create extension if not exists unaccent with schema extensions;

-- Helpers -----------------------------------------------------------------------------------------

-- Whether a student has opened any assignment of the group.
create function public.is_started_group(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.attempt t
    join public.exercise_assignment a on a.id = t.assignment_id
    where a.group_id = target_group_id
  );
$$;

create function public.is_active_student(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_user
    where id = target_user_id and role = 'student' and status = 'active'
  );
$$;

-- The teacher of a group is an active teacher: an administrator already sees every group.
create function public.is_active_teacher(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_user
    where id = target_user_id and role = 'teacher' and status = 'active'
  );
$$;

revoke execute on function
  public.is_started_group(uuid),
  public.is_active_student(uuid),
  public.is_active_teacher(uuid)
from public, anon;

grant execute on function
  public.is_started_group(uuid),
  public.is_active_student(uuid),
  public.is_active_teacher(uuid)
to authenticated;

-- class_group -------------------------------------------------------------------------------------

alter table public.class_group
  add constraint class_group_school_year_format check (school_year ~ '^\d{4}/\d{2}$');

drop policy "Admins manage groups" on public.class_group;

-- Who may write each group is the RLS (`42501`, forbidden); whether its teacher is valid, this
-- trigger, before it (`23514`, invalid), as the mock service tells them apart.
create function public.check_group_teacher()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_active_teacher(new.teacher_id) then
    raise exception 'The teacher of a group is an active teacher' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_group_teacher() from public, anon, authenticated;

create trigger check_group_teacher
before insert or update of teacher_id on public.class_group
for each row execute function public.check_group_teacher();

create policy "Teachers create groups of their own; admins, any"
on public.class_group for insert to authenticated
with check (public.is_admin() or teacher_id = (select auth.uid()));

create policy "Teachers change their groups; admins, any and its teacher"
on public.class_group for update to authenticated
using (public.is_admin() or public.teaches_group(id))
with check (public.is_admin() or teacher_id = (select auth.uid()));

create policy "Teachers delete their groups nobody started"
on public.class_group for delete to authenticated
using ((public.is_admin() or public.teaches_group(id)) and not public.is_started_group(id));

-- A group never changes subject.
revoke update on public.class_group from authenticated;
grant update (name, school_year, teacher_id) on public.class_group to authenticated;

-- enrollment --------------------------------------------------------------------------------------

drop policy "Admins manage enrollments" on public.enrollment;

-- Only active students are enrolled: `23514`, invalid, as the teacher of a group.
create function public.check_enrolled_student()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_active_student(new.user_id) then
    raise exception 'Only active students are enrolled' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_enrolled_student() from public, anon, authenticated;

create trigger check_enrolled_student
before insert on public.enrollment
for each row execute function public.check_enrolled_student();

create policy "Teachers enroll students in their groups"
on public.enrollment for insert to authenticated
with check (public.is_admin() or public.teaches_group(group_id));

-- Deleting an enrollment keeps the attempts: the teacher still sees what the student did.
create policy "Teachers unenroll from their groups"
on public.enrollment for delete to authenticated
using (public.is_admin() or public.teaches_group(group_id));

-- An enrollment is never edited.
revoke update on public.enrollment from authenticated;

-- Finding students to enroll (RF-16) --------------------------------------------------------------

-- Active students of the whole school who are not in the group, by name and only name and email: at
-- least two letters and twenty at most, so nobody lists the whole school.
create function public.search_students(search text, target_group_id uuid)
returns table (id uuid, name text, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pattern text;
begin
  if not (public.is_admin() or public.teaches_group(target_group_id)) then
    raise exception 'Not a group of yours' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(search, ''))) < 2 then
    raise exception 'The search needs two letters' using errcode = '22023';
  end if;
  pattern := '%' || replace(replace(replace(
    extensions.unaccent(lower(btrim(search))), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query
    select u.id, u.name, u.email
    from public.app_user u
    where u.role = 'student'
      and u.status = 'active'
      and not exists (
        select 1 from public.enrollment e where e.group_id = target_group_id and e.user_id = u.id
      )
      and (
        extensions.unaccent(lower(u.name)) like pattern escape '\'
        or lower(u.email) like pattern escape '\'
      )
    order by u.name
    limit 20;
end;
$$;

revoke execute on function public.search_students(text, uuid) from public, anon;
grant execute on function public.search_students(text, uuid) to authenticated;

-- Each group the caller manages, with how many students it has and whether somebody started it,
-- which the list of groups shows. Security invoker: the RLS gives the groups.
create function public.group_summaries()
returns table (group_id uuid, student_count integer, is_started boolean)
language sql
stable
set search_path = ''
as $$
  select g.id,
    (select count(*)::integer from public.enrollment e where e.group_id = g.id),
    public.is_started_group(g.id)
  from public.class_group g
  where public.is_admin() or public.teaches_group(g.id);
$$;

revoke execute on function public.group_summaries() from public, anon;
grant execute on function public.group_summaries() to authenticated;
