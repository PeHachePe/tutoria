-- Step 5.2d · The class, shared by the teachers of the school (docs/PLAN.md §2.3, D-081).
-- 5.2c made the class implicit: the groups with the same name and year (D-079). Several teachers
-- teach the same class, though, so the class is now a row of its own, once per school, with its
-- students: each subject is still a group of its teacher (blocks, live panel and analytics do not
-- change), which takes the whole class when it is created and keeps its own enrollment after, so a
-- student can skip a subject (a convalidated one) or join one from another class. Two groups of the
-- same subject in a class are a split (a «desdoble»): the second has a label and its students are
-- chosen by hand.

-- school_class ------------------------------------------------------------------------------------

create table public.school_class (
  id uuid primary key default gen_random_uuid(),
  name text not null constraint school_class_name_format check (name = btrim(name) and name <> ''),
  -- For example, `2026/27`.
  school_year text not null
    constraint school_class_school_year_format check (school_year ~ '^\d{4}/\d{2}$'),
  -- Who may rename or delete it, besides the administration; nobody once their account is gone.
  created_by uuid references public.app_user (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Once per school and year, whatever the capitals: «1.º daw a» is «1.º DAW A».
create unique index school_class_name_year_key on public.school_class (lower(name), school_year);
create index school_class_created_by_idx on public.school_class (created_by);

-- The students of each class: who its groups take when they are created or the class is enrolled.
create table public.class_member (
  class_id uuid not null references public.school_class (id) on delete cascade,
  user_id uuid not null references public.app_user (id) on delete cascade,
  primary key (class_id, user_id)
);

create index class_member_user_id_idx on public.class_member (user_id);

-- class_group: from name and year to its class ------------------------------------------------------

alter table public.class_group
  add column class_id uuid references public.school_class (id) on delete restrict,
  -- What tells a split apart: «Desdoble alemán». None for the group of the whole class.
  add column label text
    constraint class_group_label_format check (
      label is null or (label = btrim(label) and label <> '' and char_length(label) <= 30)
    );

-- Each class of today, once, by its first teacher.
insert into public.school_class (name, school_year, created_by)
select distinct on (lower(btrim(name)), school_year) btrim(name), school_year, teacher_id
from public.class_group
order by lower(btrim(name)), school_year, teacher_id;

update public.class_group g
set class_id = c.id
from public.school_class c
where lower(btrim(g.name)) = lower(c.name) and g.school_year = c.school_year;

-- Two groups of one subject in a class were already a split: numbered, so they stay apart.
with numbered as (
  select id, row_number() over (partition by class_id, subject_id order by id) as n
  from public.class_group
)
update public.class_group g
set label = 'Desdoble ' || numbered.n
from numbered
where numbered.id = g.id and numbered.n > 1;

-- The students of a class: whoever is in any of its groups.
insert into public.class_member (class_id, user_id)
select distinct g.class_id, e.user_id
from public.enrollment e
join public.class_group g on g.id = e.group_id;

alter table public.class_group
  alter column class_id set not null,
  drop column name,
  drop column school_year,
  add constraint class_group_class_subject_label_key unique nulls not distinct
    (class_id, subject_id, label);

-- Helpers -----------------------------------------------------------------------------------------

-- The signed-in teacher has a group in the class.
create function public.teaches_class(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_app_role() = 'teacher' and exists (
    select 1 from public.class_group
    where class_id = target_class_id and teacher_id = (select auth.uid())
  );
$$;

-- Who looks after a class and its students: the administration, its teachers and whoever created
-- it (before adding a subject).
create function public.manages_class(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or public.teaches_class(target_class_id) or (
    public.current_app_role() = 'teacher' and exists (
      select 1 from public.school_class
      where id = target_class_id and created_by = (select auth.uid())
    )
  );
$$;

-- The signed-in student is in a group of the class: they read its name.
create function public.studies_in_class(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_app_role() is not null and exists (
    select 1 from public.enrollment e
    join public.class_group g on g.id = e.group_id
    where g.class_id = target_class_id and e.user_id = (select auth.uid())
  );
$$;

-- A class without groups, which its creator or the administration may delete.
create function public.is_empty_class(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.class_group where class_id = target_class_id);
$$;

revoke execute on function
  public.teaches_class(uuid),
  public.manages_class(uuid),
  public.studies_in_class(uuid),
  public.is_empty_class(uuid)
from public, anon;

grant execute on function
  public.teaches_class(uuid),
  public.manages_class(uuid),
  public.studies_in_class(uuid),
  public.is_empty_class(uuid)
to authenticated;

-- Row level security ------------------------------------------------------------------------------

alter table public.school_class enable row level security;
alter table public.class_member enable row level security;

revoke all on public.school_class, public.class_member from anon, authenticated;

-- Every teacher reads every class, to join it with a subject; a student, those of their groups.
-- Classes are created through `create_class` and `duplicate_class`.
grant select, delete on public.school_class to authenticated;
grant update (name, school_year) on public.school_class to authenticated;

create policy "Staff read every class; students, theirs"
on public.school_class for select to authenticated
using (public.is_staff() or public.studies_in_class(id));

create policy "Creators and admins rename a class"
on public.school_class for update to authenticated
using (public.is_admin() or (created_by = (select auth.uid()) and public.is_staff()))
with check (public.is_admin() or (created_by = (select auth.uid()) and public.is_staff()));

create policy "Creators and admins delete an empty class"
on public.school_class for delete to authenticated
using (
  (public.is_admin() or (created_by = (select auth.uid()) and public.is_staff()))
  and public.is_empty_class(id)
);

-- The students of a class are written only through functions, as enrollment (D-072).
grant select on public.class_member to authenticated;

create policy "Students read their classes; staff, the classes they look after"
on public.class_member for select to authenticated
using (
  (user_id = (select auth.uid()) and public.current_app_role() is not null)
  or public.manages_class(class_id)
);

-- A group is created through `create_class`, `add_class_group` or `duplicate_class`, which give it
-- the students of its class; of an existing one, its label and (the administration) its teacher.
drop policy "Teachers create groups of their own; admins, any" on public.class_group;
revoke insert, update on public.class_group from authenticated;
grant update (label, teacher_id) on public.class_group to authenticated;

-- Creating groups -----------------------------------------------------------------------------------

-- The class with that name and year, created by the caller if there is none. Without checks: the
-- functions that call it decide who may.
create function public.find_or_create_class(class_name text, class_school_year text)
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
  return found_id;
end;
$$;

-- A group of the class in the subject, with the label (trimmed; none if blank) and teacher given
-- and, if `with_class_students`, the active students of the class. Without checks, as above.
create function public.create_class_group(
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
  insert into public.class_group (class_id, subject_id, label, teacher_id)
  values (target_class_id, target_subject_id, nullif(btrim(group_label), ''), group_teacher_id)
  returning id into created_id;
  if with_class_students then
    insert into public.enrollment (group_id, user_id)
    select created_id, m.user_id
    from public.class_member m
    join public.app_user u on u.id = m.user_id
    where m.class_id = target_class_id and u.role = 'student' and u.status = 'active';
  end if;
  return created_id;
end;
$$;

revoke execute on function
  public.find_or_create_class(text, text),
  public.create_class_group(uuid, uuid, text, uuid, boolean)
from public, anon, authenticated;

-- A new class (or the one with that name and year, which the caller joins) with a group of the
-- teacher in each subject, all or none: each takes the students of the class. Security definer, as
-- students are only enrolled through functions (D-072); the checks of the tables do the rest
-- (`23514`: blank name, year not like `2026/27`, a teacher who is not an active one; `23505`: a
-- subject the class already has without a label).
create function public.create_class(
  class_name text,
  class_school_year text,
  subject_ids uuid[],
  group_teacher_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_class_id uuid;
  each_subject_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Only the staff create classes' using errcode = '42501';
  end if;
  if coalesce(cardinality(subject_ids), 0) > 20
    or cardinality(subject_ids) <> (select count(distinct s) from unnest(subject_ids) s) then
    raise exception 'Up to 20 different subjects' using errcode = '22023';
  end if;
  if coalesce(cardinality(subject_ids), 0) > 0 and not public.is_admin()
    and group_teacher_id is distinct from (select auth.uid()) then
    raise exception 'A teacher creates groups of their own' using errcode = '42501';
  end if;
  created_class_id := public.find_or_create_class(class_name, class_school_year);
  foreach each_subject_id in array coalesce(subject_ids, '{}') loop
    perform public.create_class_group(
      created_class_id, each_subject_id, null, group_teacher_id, true
    );
  end loop;
  return created_class_id;
end;
$$;

-- A group in a class: any teacher joins any class with a subject of theirs. Without a label it is
-- the group of the whole class, with its students; with one, a split, whose students are chosen.
create function public.add_class_group(
  target_class_id uuid,
  target_subject_id uuid,
  group_label text,
  group_teacher_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Only the staff create groups' using errcode = '42501';
  end if;
  if not public.is_admin() and group_teacher_id is distinct from (select auth.uid()) then
    raise exception 'A teacher creates groups of their own' using errcode = '42501';
  end if;
  if not exists (select 1 from public.school_class where id = target_class_id) then
    raise exception 'No such class' using errcode = 'P0002';
  end if;
  return public.create_class_group(
    target_class_id,
    target_subject_id,
    group_label,
    group_teacher_id,
    nullif(btrim(group_label), '') is null
  );
end;
$$;

revoke execute on function
  public.create_class(text, text, uuid[], uuid),
  public.add_class_group(uuid, uuid, text, uuid)
from public, anon;
grant execute on function
  public.create_class(text, text, uuid[], uuid),
  public.add_class_group(uuid, uuid, text, uuid)
to authenticated;

-- Duplicating a class (Grupos) ---------------------------------------------------------------------

-- The class with the name and year given (created, or joined if it exists) with a copy of each
-- source group: its subject, label and teacher (the caller's own groups, or any for the
-- administration) and, if asked, its blocks (dates moved to the new year or none). With its
-- students, the active ones of the class and of each group; without them, a group of the whole
-- class takes those the new class already has. All or none; it returns the new class.
create function public.duplicate_class(
  source_class_id uuid,
  class_name text,
  class_school_year text,
  source_group_ids uuid[],
  with_blocks boolean,
  with_dates boolean,
  with_students boolean,
  time_zone text default 'UTC'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_year text;
  target_class_id uuid;
  source public.class_group;
  created_id uuid;
begin
  select school_year into source_year from public.school_class where id = source_class_id;
  if source_year is null or not public.manages_class(source_class_id) then
    raise exception 'No such class' using errcode = 'P0002';
  end if;
  if coalesce(cardinality(source_group_ids), 0) not between 1 and 20
    or cardinality(source_group_ids) <> (select count(distinct s) from unnest(source_group_ids) s)
  then
    raise exception 'Between 1 and 20 different groups' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(source_group_ids) s
    where not exists (
      select 1 from public.class_group g
      where g.id = s and g.class_id = source_class_id
        and (public.is_admin() or public.teaches_group(g.id))
    )
  ) then
    raise exception 'No such group' using errcode = 'P0002';
  end if;
  target_class_id := public.find_or_create_class(class_name, class_school_year);
  if target_class_id = source_class_id then
    raise exception 'A class is duplicated into another' using errcode = '22023';
  end if;
  if with_students then
    insert into public.class_member (class_id, user_id)
    select target_class_id, m.user_id
    from public.class_member m
    join public.app_user u on u.id = m.user_id
    where m.class_id = source_class_id and u.role = 'student' and u.status = 'active'
    on conflict do nothing;
  end if;
  for source in
    select g.* from unnest(source_group_ids) with ordinality as t (s, n)
    join public.class_group g on g.id = t.s
    order by t.n
  loop
    created_id := public.create_class_group(
      target_class_id, source.subject_id, source.label, source.teacher_id,
      not with_students and source.label is null
    );
    if with_blocks then
      perform public.copy_group_blocks(
        source.id,
        created_id,
        case when with_dates
          then public.school_year_shift_days(source_year, class_school_year)
        end,
        time_zone
      );
    end if;
    if with_students then
      insert into public.enrollment (group_id, user_id)
      select created_id, e.user_id
      from public.enrollment e
      join public.app_user u on u.id = e.user_id
      where e.group_id = source.id and u.role = 'student' and u.status = 'active';
    end if;
  end loop;
  return target_class_id;
end;
$$;

revoke execute on function
  public.duplicate_class(uuid, text, text, uuid[], boolean, boolean, boolean, text)
from public, anon;
grant execute on function
  public.duplicate_class(uuid, text, text, uuid[], boolean, boolean, boolean, text)
to authenticated;

-- What 5.2c did with the implicit class
drop function public.duplicate_groups(uuid[], text, text, uuid, boolean, boolean, boolean, text);
drop function public.enroll_students(uuid, uuid[], uuid[]);

-- The year of a group is that of its class.
create or replace function public.copy_blocks(
  source_group_id uuid,
  target_group_id uuid,
  with_dates boolean,
  time_zone text default 'UTC'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_year text;
  target_year text;
begin
  if not (public.is_admin() or public.teaches_group(source_group_id))
    or not (public.is_admin() or public.teaches_group(target_group_id)) then
    raise exception 'No such group' using errcode = 'P0002';
  end if;
  if source_group_id = target_group_id then
    raise exception 'A group is copied into another' using errcode = '22023';
  end if;
  select c.school_year into source_year
  from public.class_group g join public.school_class c on c.id = g.class_id
  where g.id = source_group_id;
  select c.school_year into target_year
  from public.class_group g join public.school_class c on c.id = g.class_id
  where g.id = target_group_id;
  if source_year is null or target_year is null then
    raise exception 'No such group' using errcode = 'P0002';
  end if;
  return public.copy_group_blocks(
    source_group_id,
    target_group_id,
    case when with_dates then public.school_year_shift_days(source_year, target_year) end,
    time_zone
  );
end;
$$;

-- The groups of the screen ----------------------------------------------------------------------------

-- The classes the caller looks after (all of them, for the administration), and whether they
-- rename it and, empty, delete it: its creator or the administration, as the RLS.
create function public.managed_classes()
returns table (
  id uuid,
  name text,
  school_year text,
  created_by uuid,
  created_at timestamptz,
  can_edit boolean
)
language sql
stable
set search_path = ''
as $$
  select c.id, c.name, c.school_year, c.created_by, c.created_at,
    public.is_admin() or (c.created_by = (select auth.uid()) and public.is_staff())
  from public.school_class c
  where public.manages_class(c.id);
$$;

-- Every group of those classes, those of other teachers too, with the name of its teacher, how many
-- students it has, whether somebody started it and whether the caller manages it: who teaches what
-- is no secret among the staff (D-081). Security definer: the RLS of `class_group` gives only the
-- caller's own groups.
create function public.class_overview()
returns table (
  group_id uuid,
  class_id uuid,
  subject_id uuid,
  label text,
  teacher_id uuid,
  teacher_name text,
  student_count integer,
  is_started boolean,
  is_mine boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.class_id, g.subject_id, g.label, g.teacher_id, u.name,
    (select count(*)::integer from public.enrollment e where e.group_id = g.id),
    public.is_started_group(g.id),
    public.is_admin() or public.teaches_group(g.id)
  from public.class_group g
  join public.app_user u on u.id = g.teacher_id
  where public.manages_class(g.class_id);
$$;

drop function public.group_summaries();

revoke execute on function public.managed_classes(), public.class_overview() from public, anon;
grant execute on function public.managed_classes(), public.class_overview() to authenticated;

-- The students of a class ----------------------------------------------------------------------------

-- The students of the class and those in any of its groups (a subject taken from another class),
-- by name, with the groups of the class they are in. Who looks after the class reads them all, the
-- name and email only: their work in a group stays with its teacher (D-062).
create function public.class_roster(target_class_id uuid)
returns table (
  id uuid,
  name text,
  email text,
  is_active boolean,
  is_member boolean,
  group_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.manages_class(target_class_id) then
    raise exception 'No such class' using errcode = 'P0002';
  end if;
  return query
    with people as (
      select m.user_id from public.class_member m where m.class_id = target_class_id
      union
      select e.user_id from public.enrollment e
      join public.class_group g on g.id = e.group_id
      where g.class_id = target_class_id
    )
    select u.id, u.name, u.email, u.status = 'active',
      exists (
        select 1 from public.class_member m
        where m.class_id = target_class_id and m.user_id = u.id
      ),
      coalesce(
        (select array_agg(e.group_id order by e.group_id) from public.enrollment e
         join public.class_group g on g.id = e.group_id
         where g.class_id = target_class_id and e.user_id = u.id),
        '{}'
      )
    from people p
    join public.app_user u on u.id = p.user_id
    order by u.name, u.id;
end;
$$;

-- Active students of the whole school who are not in the class, as `search_students`.
create function public.search_class_students(search text, target_class_id uuid)
returns table (id uuid, name text, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pattern text;
begin
  if not public.manages_class(target_class_id) then
    raise exception 'No such class' using errcode = 'P0002';
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
        select 1 from public.class_member m where m.class_id = target_class_id and m.user_id = u.id
      )
      and (
        extensions.unaccent(lower(u.name)) like pattern escape '\'
        or lower(u.email) like pattern escape '\'
      )
    order by u.name
    limit 20;
end;
$$;

-- Into the class and every group of the whole class (those without a label), all or none: 50 at
-- most, active students only (`23514`). Who is already in the class or a group is skipped there.
create function public.enroll_class_members(target_class_id uuid, student_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.manages_class(target_class_id) then
    raise exception 'No such class' using errcode = 'P0002';
  end if;
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
  on conflict (group_id, user_id) do nothing;
end;
$$;

-- Out of the class and every group of it, those of other teachers too: the roster is shared. Their
-- attempts are kept, as when they leave a group.
create function public.remove_class_member(target_class_id uuid, student_id uuid)
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

-- In one group, as before 5.2c: a subject taken from another class, or back after skipping it.
create function public.enroll_students(target_group_id uuid, student_ids uuid[])
returns table (enrollment_id uuid, id uuid, name text, email text)
language plpgsql
security definer
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

revoke execute on function
  public.class_roster(uuid),
  public.search_class_students(text, uuid),
  public.enroll_class_members(uuid, uuid[]),
  public.remove_class_member(uuid, uuid),
  public.enroll_students(uuid, uuid[])
from public, anon;
grant execute on function
  public.class_roster(uuid),
  public.search_class_students(text, uuid),
  public.enroll_class_members(uuid, uuid[]),
  public.remove_class_member(uuid, uuid),
  public.enroll_students(uuid, uuid[])
to authenticated;
