-- Step 5.2c · Setting up a new school year faster (docs/PLAN.md §2.3, D-079). A class is the groups
-- with the same name and year, one per subject: they are duplicated together for the next year or
-- a parallel group, with their blocks and, if wanted, their students; the blocks of a group are
-- copied into another; and a student is enrolled in several groups of the class at once.

-- Dates in another school year ----------------------------------------------------------------------

-- The days between two school years in whole weeks, so a date keeps its weekday: Friday 20/11/2026
-- is Friday 19/11/2027. Zero within the same year.
create function public.school_year_shift_days(source_year text, target_year text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (round((left(target_year, 4)::integer - left(source_year, 4)::integer) * 365.2425 / 7)
    * 7)::integer;
$$;

-- The blocks of a group after those of another, in their order, with their exercises, order,
-- visibility and translations; their dates moved by `shift_days` in `time_zone`, so 23:59 is still
-- 23:59 across a change of time, or none if `shift_days` is null. Without checks: the functions that
-- call it decide who may.
create function public.copy_group_blocks(
  source_group_id uuid,
  target_group_id uuid,
  shift_days integer,
  time_zone text
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  last_position integer;
  source_block public.class_block;
  new_block_id uuid;
  copied integer := 0;
begin
  select coalesce(max(position), 0) into last_position
  from public.class_block where group_id = target_group_id;
  for source_block in
    select * from public.class_block where group_id = source_group_id order by position
  loop
    copied := copied + 1;
    insert into public.class_block (
      group_id, position, title, source_locale, translations, is_hidden, opens_at
    )
    values (
      target_group_id, last_position + copied, source_block.title, source_block.source_locale,
      source_block.translations, source_block.is_hidden,
      case when shift_days is not null then
        ((source_block.opens_at at time zone time_zone) + make_interval(days => shift_days))
          at time zone time_zone
      end
    )
    returning id into new_block_id;
    insert into public.exercise_assignment (
      group_id, block_id, exercise_id, position, is_hidden, due_at
    )
    select target_group_id, new_block_id, a.exercise_id, a.position, a.is_hidden,
      case when shift_days is not null then
        ((a.due_at at time zone time_zone) + make_interval(days => shift_days)) at time zone time_zone
      end
    from public.exercise_assignment a
    where a.block_id = source_block.id
    order by a.position;
  end loop;
  return copied;
end;
$$;

revoke execute on function
  public.school_year_shift_days(text, text),
  public.copy_group_blocks(uuid, uuid, integer, text)
from public, anon, authenticated;

-- Copying blocks (Bloques) -------------------------------------------------------------------------

-- The blocks of another group of the caller after those of this one, with their dates moved to its
-- year or without them; how many blocks were copied. Security definer, to call the copy: it checks
-- both groups itself, and a group of others is not found.
create function public.copy_blocks(
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
  select school_year into source_year from public.class_group where id = source_group_id;
  select school_year into target_year from public.class_group where id = target_group_id;
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

revoke execute on function public.copy_blocks(uuid, uuid, boolean, text) from public, anon;
grant execute on function public.copy_blocks(uuid, uuid, boolean, text) to authenticated;

-- Duplicating a class (Grupos) ---------------------------------------------------------------------

-- A new group for each source group, in the same subject, with the name, year and teacher given
-- and, if asked, its blocks (dates moved to the new year or none) and its active students; all or
-- none, in the order given. Security definer, as students are only enrolled through functions
-- (D-072): it checks the groups and the teacher itself, and the checks of the tables do the rest
-- (`23514`: blank name, year not like `2026/27`, a teacher who is not an active one).
create function public.duplicate_groups(
  source_group_ids uuid[],
  group_name text,
  group_school_year text,
  group_teacher_id uuid,
  with_blocks boolean,
  with_dates boolean,
  with_students boolean,
  time_zone text default 'UTC'
)
returns setof public.class_group
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_id uuid;
  source public.class_group;
  created public.class_group;
begin
  if coalesce(cardinality(source_group_ids), 0) not between 1 and 20
    or cardinality(source_group_ids) <> (select count(distinct s) from unnest(source_group_ids) s)
  then
    raise exception 'Between 1 and 20 different groups' using errcode = '22023';
  end if;
  if not public.is_admin() and group_teacher_id is distinct from (select auth.uid()) then
    raise exception 'A teacher creates groups of their own' using errcode = '42501';
  end if;
  foreach source_id in array source_group_ids loop
    select * into source from public.class_group where id = source_id;
    if not found or not (public.is_admin() or public.teaches_group(source_id)) then
      raise exception 'No such group' using errcode = 'P0002';
    end if;
    insert into public.class_group (name, school_year, teacher_id, subject_id)
    values (group_name, group_school_year, group_teacher_id, source.subject_id)
    returning * into created;
    if with_blocks then
      perform public.copy_group_blocks(
        source.id,
        created.id,
        case when with_dates
          then public.school_year_shift_days(source.school_year, group_school_year)
        end,
        time_zone
      );
    end if;
    if with_students then
      insert into public.enrollment (group_id, user_id)
      select created.id, e.user_id
      from public.enrollment e
      join public.app_user u on u.id = e.user_id
      where e.group_id = source.id and u.role = 'student' and u.status = 'active';
    end if;
    return next created;
  end loop;
end;
$$;

revoke execute on function
  public.duplicate_groups(uuid[], text, text, uuid, boolean, boolean, boolean, text)
from public, anon;
grant execute on function
  public.duplicate_groups(uuid[], text, text, uuid, boolean, boolean, boolean, text)
to authenticated;

-- Enrolling in the whole class ----------------------------------------------------------------------

-- As before, and also in `also_group_ids` (other groups of the caller, 20 at most), skipping there
-- those already in them: a student who is in one subject of the class is not an error in another.
-- What it returns is still the enrollment of `target_group_id`.
drop function public.enroll_students(uuid, uuid[]);

create function public.enroll_students(
  target_group_id uuid,
  student_ids uuid[],
  also_group_ids uuid[] default '{}'
)
returns table (enrollment_id uuid, id uuid, name text, email text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or public.teaches_group(target_group_id))
    or exists (
      select 1 from unnest(coalesce(also_group_ids, '{}')) g
      where not (public.is_admin() or public.teaches_group(g))
    ) then
    raise exception 'No such group' using errcode = 'P0002';
  end if;
  if coalesce(cardinality(student_ids), 0) not between 1 and 50
    or cardinality(student_ids) <> (select count(distinct s) from unnest(student_ids) s)
    or coalesce(cardinality(also_group_ids), 0) > 20 then
    raise exception 'Between 1 and 50 different students, in 20 more groups at most'
      using errcode = '22023';
  end if;
  insert into public.enrollment (group_id, user_id)
  select target_group_id, s from unnest(student_ids) with ordinality as t (s, n) order by n;
  insert into public.enrollment (group_id, user_id)
  select g, s
  from unnest(coalesce(also_group_ids, '{}')) g
  cross join unnest(student_ids) s
  where g <> target_group_id
  on conflict (group_id, user_id) do nothing;
  return query
    select e.id, u.id, u.name, u.email
    from unnest(student_ids) with ordinality as t (s, n)
    join public.enrollment e on e.group_id = target_group_id and e.user_id = t.s
    join public.app_user u on u.id = t.s
    order by t.n;
end;
$$;

revoke execute on function public.enroll_students(uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.enroll_students(uuid, uuid[], uuid[]) to authenticated;
