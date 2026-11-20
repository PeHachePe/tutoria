-- Step 5.2e · The classes of past years, closed (docs/PLAN.md §2.3, D-082).
-- A class of a year before the current one (which starts on 1 September, in the time of the school)
-- is read only for everybody: nobody enrolls in it, adds or changes its groups, renames or deletes
-- it. It is still read and duplicated, which is how a new year is prepared. The administration may
-- reopen one (and close it again) to fix it.

alter table public.school_class
  -- The administration reopened it although its year is over.
  add column reopened boolean not null default false;

-- The school year of today, as `2026/27`: from 1 September, in the time of the school, which is
-- that of the demo and its tests (D-074).
create function public.current_school_year()
returns text
language sql
stable
set search_path = ''
as $$
  with today as (
    select (now() at time zone 'Europe/Madrid')::date as day
  ), start as (
    select extract(year from day)::integer - (extract(month from day) < 9)::integer as year
    from today
  )
  select year || '/' || lpad(((year + 1) % 100)::text, 2, '0') from start;
$$;

-- A class whose year is not over, or one the administration reopened.
create function public.is_open_class(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.school_class
    where id = target_class_id
      and (school_year >= public.current_school_year() or reopened)
  );
$$;

-- The group of an open class.
create function public.is_open_group(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.class_group g
    where g.id = target_group_id and public.is_open_class(g.class_id)
  );
$$;

revoke execute on function
  public.current_school_year(),
  public.is_open_class(uuid),
  public.is_open_group(uuid)
from public, anon;
grant execute on function
  public.current_school_year(),
  public.is_open_class(uuid),
  public.is_open_group(uuid)
to authenticated;

-- Row level security: the direct writes, only in an open class -------------------------------------

-- Its row says whether it is open, before and after: a year is never moved to the past to close it
-- (`reopened` is not granted, only `reopen_class` changes it).
drop policy "Creators and admins rename a class" on public.school_class;
create policy "Creators and admins rename an open class"
on public.school_class for update to authenticated
using (
  (public.is_admin() or (created_by = (select auth.uid()) and public.is_staff()))
  and (school_year >= public.current_school_year() or reopened)
)
with check (
  (public.is_admin() or (created_by = (select auth.uid()) and public.is_staff()))
  and (school_year >= public.current_school_year() or reopened)
);

drop policy "Creators and admins delete an empty class" on public.school_class;
create policy "Creators and admins delete an empty open class"
on public.school_class for delete to authenticated
using (
  (public.is_admin() or (created_by = (select auth.uid()) and public.is_staff()))
  and public.is_empty_class(id)
  and (school_year >= public.current_school_year() or reopened)
);

drop policy "Teachers change their groups; admins, any and its teacher" on public.class_group;
create policy "Teachers change their open groups; admins, any open one and its teacher"
on public.class_group for update to authenticated
using ((public.is_admin() or public.teaches_group(id)) and public.is_open_group(id))
with check (public.is_admin() or teacher_id = (select auth.uid()));

drop policy "Teachers delete their groups nobody started" on public.class_group;
create policy "Teachers delete their open groups nobody started"
on public.class_group for delete to authenticated
using (
  (public.is_admin() or public.teaches_group(id))
  and not public.is_started_group(id)
  and public.is_open_group(id)
);

-- Deleting an enrollment keeps the attempts: the teacher still sees what the student did.
drop policy "Teachers unenroll from their groups" on public.enrollment;
create policy "Teachers unenroll from their open groups"
on public.enrollment for delete to authenticated
using ((public.is_admin() or public.teaches_group(group_id)) and public.is_open_group(group_id));

-- Reopening ------------------------------------------------------------------------------------------

-- The administration reopens a class of a past year, or closes it again.
create function public.reopen_class(target_class_id uuid, reopen boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the administration reopens a class' using errcode = '42501';
  end if;
  update public.school_class set reopened = reopen where id = target_class_id;
  if not found then
    raise exception 'No such class' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.reopen_class(uuid, boolean) from public, anon;
grant execute on function public.reopen_class(uuid, boolean) to authenticated;

-- The functions that write a class: only an open one ----------------------------------------------

-- `42501`, the error of a write that is not allowed, as the RLS.
create function public.check_open_class(target_class_id uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.is_open_class(target_class_id) then
    raise exception 'The class is of a past year' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.check_open_class(uuid) from public, anon, authenticated;

-- As in 5.2d, and the class found or created must be open: nobody creates a class of a past year,
-- nor joins or duplicates into a closed one (`create_class`, `duplicate_class`).
create or replace function public.find_or_create_class(class_name text, class_school_year text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  found_id uuid;
begin
  select id into found_id from public.school_class
  where lower(name) = lower(btrim(class_name)) and school_year = class_school_year;
  if found_id is null then
    insert into public.school_class (name, school_year, created_by)
    values (btrim(class_name), class_school_year, (select auth.uid()))
    returning id into found_id;
  end if;
  perform public.check_open_class(found_id);
  return found_id;
end;
$$;

-- As in 5.2d, in an open class only (`create_class`, `add_class_group`, `duplicate_class`).
create or replace function public.create_class_group(
  target_class_id uuid,
  target_subject_id uuid,
  group_label text,
  group_teacher_id uuid,
  with_class_students boolean
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  created_id uuid;
begin
  perform public.check_open_class(target_class_id);
  insert into public.class_group (class_id, subject_id, label, teacher_id)
  values (target_class_id, target_subject_id, nullif(btrim(group_label), ''), group_teacher_id)
  returning id into created_id;
  if with_class_students then
    insert into public.enrollment (group_id, user_id)
    select created_id, m.user_id
    from public.class_member m
    join public.app_user u on u.id = m.user_id
    where m.class_id = target_class_id and u.role = 'student' and u.status = 'active'
      and not exists (
        select 1 from public.enrollment e
        join public.class_group g on g.id = e.group_id
        where g.class_id = target_class_id and g.subject_id = target_subject_id
          and e.user_id = m.user_id
      );
  end if;
  return created_id;
end;
$$;

revoke execute on function
  public.find_or_create_class(text, text),
  public.create_class_group(uuid, uuid, text, uuid, boolean)
from public, anon, authenticated;

-- As in 5.2d, in an open class only.
create or replace function public.enroll_class_members(target_class_id uuid, student_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.manages_class(target_class_id) then
    raise exception 'No such class' using errcode = 'P0002';
  end if;
  perform public.check_open_class(target_class_id);
  if coalesce(cardinality(student_ids), 0) not between 1 and 50
    or cardinality(student_ids) <> (select count(distinct s) from unnest(student_ids) s) then
    raise exception 'Between 1 and 50 different students' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(student_ids) s where not public.is_active_student(s)) then
    raise exception 'Only active students are enrolled' using errcode = '23514';
  end if;
  insert into public.class_member (class_id, user_id)
  select target_class_id, s from unnest(student_ids) s
  on conflict do nothing;
  insert into public.enrollment (group_id, user_id)
  select g.id, s
  from public.class_group g
  cross join unnest(student_ids) s
  where g.class_id = target_class_id and g.label is null
    -- Not who takes the subject in a split already
    and not exists (
      select 1 from public.enrollment e
      join public.class_group other on other.id = e.group_id
      where other.class_id = target_class_id and other.subject_id = g.subject_id
        and e.user_id = s
    )
  on conflict (group_id, user_id) do nothing;
end;
$$;

-- As in 5.2d, in an open class only.
create or replace function public.remove_class_member(target_class_id uuid, student_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
  unenrolled integer;
begin
  if not public.manages_class(target_class_id) then
    raise exception 'No such class' using errcode = 'P0002';
  end if;
  perform public.check_open_class(target_class_id);
  delete from public.class_member where class_id = target_class_id and user_id = student_id;
  get diagnostics removed = row_count;
  delete from public.enrollment e
  using public.class_group g
  where g.id = e.group_id and g.class_id = target_class_id and e.user_id = student_id;
  get diagnostics unenrolled = row_count;
  if removed + unenrolled = 0 then
    raise exception 'Not in the class' using errcode = 'P0002';
  end if;
end;
$$;

-- As in 5.2d, in a group of an open class only.
create or replace function public.enroll_students(target_group_id uuid, student_ids uuid[])
returns table (enrollment_id uuid, id uuid, name text, email text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or public.teaches_group(target_group_id)) then
    raise exception 'No such group' using errcode = 'P0002';
  end if;
  if not public.is_open_group(target_group_id) then
    raise exception 'The class is of a past year' using errcode = '42501';
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

-- What the screens read: whether each class is open ---------------------------------------------

drop function public.managed_classes();

-- As in 5.2d, with `reopened` and whether the class is open: the screen shows a closed one read only.
create function public.managed_classes()
returns table (
  id uuid,
  name text,
  school_year text,
  created_by uuid,
  created_at timestamptz,
  reopened boolean,
  can_edit boolean,
  is_open boolean
)
language sql
stable
set search_path = ''
as $$
  select c.id, c.name, c.school_year, c.created_by, c.created_at, c.reopened,
    public.is_admin() or (c.created_by = (select auth.uid()) and public.is_staff()),
    c.school_year >= public.current_school_year() or c.reopened
  from public.school_class c
  where public.manages_class(c.id);
$$;

revoke execute on function public.managed_classes() from public, anon;
grant execute on function public.managed_classes() to authenticated;

drop function public.school_classes();

-- As in 5.2d, with `reopened`, as the row of the class.
create function public.school_classes()
returns table (
  id uuid,
  name text,
  school_year text,
  created_by uuid,
  created_at timestamptz,
  reopened boolean,
  class_groups jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Only the staff' using errcode = '42501';
  end if;
  return query
    select c.id, c.name, c.school_year, c.created_by, c.created_at, c.reopened,
      coalesce(
        (select jsonb_agg(
           jsonb_build_object('subject_id', g.subject_id, 'label', g.label, 'teacher_name', u.name)
           order by g.subject_id, g.label nulls first)
         from public.class_group g
         join public.app_user u on u.id = g.teacher_id
         where g.class_id = c.id),
        '[]'::jsonb
      )
    from public.school_class c
    order by c.school_year desc, c.name;
end;
$$;

revoke execute on function public.school_classes() from public, anon;
grant execute on function public.school_classes() to authenticated;
