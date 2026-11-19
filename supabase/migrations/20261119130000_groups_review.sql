-- Step 5.2a, review · What the requests of the app found that the checks without them did not
-- (docs/PLAN.md §2.3, D-072).

-- A teacher reads the group they have just created: `teaches_group()` reads `class_group` with the
-- snapshot of the statement, which does not have the new row yet, so `insert … returning` failed.
-- The policy reads the row itself instead.
drop policy "Members read their groups; admins, all" on public.class_group;

create policy "Members read their groups; admins, all"
on public.class_group for select to authenticated
using (
  public.is_admin()
  or (teacher_id = (select auth.uid()) and public.current_app_role() = 'teacher')
  or public.is_enrolled(id)
);

-- The teacher is checked when it is chosen: a group whose teacher was disabled keeps its name and
-- year editable until the administration hands it over (D-072).
create or replace function public.check_group_teacher()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.teacher_id = old.teacher_id then
    return new;
  end if;
  if not public.is_active_teacher(new.teacher_id) then
    raise exception 'The teacher of a group is an active teacher' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- A group of others is not found, as the rest of the requests about a group (`listStudents`).
create or replace function public.search_students(search text, target_group_id uuid)
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
    raise exception 'No such group' using errcode = 'P0002';
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

-- Enrolls several students at once, all or none, and returns them with their name: an insert with
-- `returning` could not read them, as the new enrollments are what lets their teacher read them.
-- Security invoker: the RLS and `check_enrolled_student` decide; between 1 and 50 different students.
create function public.enroll_students(target_group_id uuid, student_ids uuid[])
returns table (enrollment_id uuid, id uuid, name text, email text)
language plpgsql
set search_path = ''
as $$
begin
  if not (public.is_admin() or public.teaches_group(target_group_id)) then
    raise exception 'No such group' using errcode = 'P0002';
  end if;
  if coalesce(cardinality(student_ids), 0) not between 1 and 50
    or cardinality(student_ids) <> (select count(distinct s) from unnest(student_ids) s) then
    raise exception 'Between 1 and 50 different students' using errcode = '22023';
  end if;
  insert into public.enrollment (group_id, user_id)
  select target_group_id, s from unnest(student_ids) with ordinality as t (s, n) order by n;
  return query
    select e.id, u.id, u.name, u.email
    from unnest(student_ids) with ordinality as t (s, n)
    join public.enrollment e on e.group_id = target_group_id and e.user_id = t.s
    join public.app_user u on u.id = t.s
    order by t.n;
end;
$$;

revoke execute on function public.enroll_students(uuid, uuid[]) from public, anon;
grant execute on function public.enroll_students(uuid, uuid[]) to authenticated;
