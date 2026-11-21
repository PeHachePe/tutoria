-- Step 5.2g · The final evaluation (docs/PLAN.md §2.3, D-084).
-- At the end of the year the teachers of a class say what happens to each of its students: they go
-- on to the next year, repeat it, finish the cycle or leave the school. It is the one thing that
-- still changes in a closed class (D-082), since the year often closes before it is done. With it,
-- the students without a class say where they come from, those who finished do not appear any more
-- when a new class is chosen, and the administration disables their accounts at once.

create type public.class_outcome as enum ('promotes', 'repeats', 'graduates', 'leaves');

alter table public.class_member
  -- None until the teachers of the class evaluate the student.
  add column outcome public.class_outcome;

-- The last class of each student up to a school year (or ever, without one), with their outcome
-- in it: where a student comes from, or where they are. Of two classes of that year, which should
-- not happen, that of the first name.
create function public.last_class_member(up_to_school_year text)
returns table (user_id uuid, class_id uuid, name text, school_year text, outcome public.class_outcome)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (m.user_id) m.user_id, c.id, c.name, c.school_year, m.outcome
  from public.class_member m
  join public.school_class c on c.id = m.class_id
  where up_to_school_year is null or c.school_year <= up_to_school_year
  order by m.user_id, c.school_year desc, c.name, c.id;
$$;

revoke execute on function public.last_class_member(text) from public, anon, authenticated;

-- Evaluating ----------------------------------------------------------------------------------------

-- The outcome of some students of a class, or none to take it back: whoever looks after the class,
-- also when it is closed. Only students of the class are evaluated (`P0002` otherwise), 100 at most.
-- It returns how many changed.
create function public.set_class_outcomes(
  target_class_id uuid,
  student_ids uuid[],
  new_outcome public.class_outcome
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if not public.manages_class(target_class_id) then
    raise exception 'No such class' using errcode = 'P0002';
  end if;
  if coalesce(cardinality(student_ids), 0) not between 1 and 100
    or cardinality(student_ids) <> (select count(distinct s) from unnest(student_ids) s) then
    raise exception 'Between 1 and 100 different students' using errcode = '22023';
  end if;
  if (select count(*) from public.class_member m
      where m.class_id = target_class_id and m.user_id = any (student_ids))
    <> cardinality(student_ids) then
    raise exception 'Not a student of the class' using errcode = 'P0002';
  end if;
  update public.class_member m set outcome = new_outcome
  where m.class_id = target_class_id and m.user_id = any (student_ids)
    and m.outcome is distinct from new_outcome;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke execute on function public.set_class_outcomes(uuid, uuid[], public.class_outcome)
from public, anon;
grant execute on function public.set_class_outcomes(uuid, uuid[], public.class_outcome)
to authenticated;

-- The students of a class, as in 5.2d, with the outcome of each student of the class, and the class
-- of the same year of who is only in one of its groups (one class a year): «De otra clase: 1.º DAM B».

drop function public.class_roster(uuid);
create function public.class_roster(target_class_id uuid)
returns table (
  id uuid,
  name text,
  email text,
  is_active boolean,
  is_member boolean,
  outcome public.class_outcome,
  other_class_name text,
  group_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  class_year text;
begin
  if not public.manages_class(target_class_id) then
    raise exception 'No such class' using errcode = 'P0002';
  end if;
  select c.school_year into class_year from public.school_class c where c.id = target_class_id;
  return query
    with people as (
      select m.user_id from public.class_member m where m.class_id = target_class_id
      union
      select e.user_id from public.enrollment e
      join public.class_group g on g.id = e.group_id
      where g.class_id = target_class_id
    )
    select u.id, u.name, u.email, u.status = 'active', m.user_id is not null, m.outcome,
      (select c.name from public.class_member o
       join public.school_class c on c.id = o.class_id
       where o.user_id = u.id and o.class_id <> target_class_id and c.school_year = class_year
       order by c.name limit 1),
      coalesce(
        (select array_agg(e.group_id order by e.group_id) from public.enrollment e
         join public.class_group g on g.id = e.group_id
         where g.class_id = target_class_id and e.user_id = u.id),
        '{}'
      )
    from people p
    join public.app_user u on u.id = p.user_id
    left join public.class_member m on m.class_id = target_class_id and m.user_id = u.id
    order by u.name, u.id;
end;
$$;

revoke execute on function public.class_roster(uuid) from public, anon;
grant execute on function public.class_roster(uuid) to authenticated;

-- The students without a class, as in 5.2d, with where they come from -------------------------------

-- Each with their last class before the year of this one (they have none in it) and its outcome, if
-- they had one. Those who finished the cycle or left the school there are left out: they are found
-- by searching for them, with that outcome to see, if they come back.
drop function public.class_candidates(uuid);
create function public.class_candidates(target_class_id uuid)
returns table (
  id uuid,
  name text,
  email text,
  last_class_name text,
  last_school_year text,
  last_outcome public.class_outcome
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  class_year text;
begin
  select c.school_year into class_year from public.school_class c where c.id = target_class_id;
  if class_year is null or not public.manages_class(target_class_id) then
    raise exception 'No such class' using errcode = 'P0002';
  end if;
  return query
    select u.id, u.name, u.email, l.name, l.school_year, l.outcome
    from public.app_user u
    left join public.last_class_member(class_year) l on l.user_id = u.id
    where u.role = 'student'
      and u.status = 'active'
      and l.outcome is distinct from 'graduates'
      and l.outcome is distinct from 'leaves'
      and not exists (
        select 1 from public.class_member m
        join public.school_class c on c.id = m.class_id
        where m.user_id = u.id and c.school_year = class_year
      )
    order by u.name, u.id;
end;
$$;

revoke execute on function public.class_candidates(uuid) from public, anon;
grant execute on function public.class_candidates(uuid) to authenticated;

-- The accounts the administration still has to disable ---------------------------------------------

-- The active students whose last class says that they finished the cycle or left the school, with
-- that class: who came back is in a class of a later year, and so is not here. Only the
-- administration (`42501`), which disables the accounts (D-072).
create function public.finished_students()
returns table (
  id uuid,
  name text,
  email text,
  outcome public.class_outcome,
  class_name text,
  school_year text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the administration' using errcode = '42501';
  end if;
  return query
    select u.id, u.name, u.email, l.outcome, l.name, l.school_year
    from public.app_user u
    join public.last_class_member(null) l on l.user_id = u.id
    where u.role = 'student' and u.status = 'active' and l.outcome in ('graduates', 'leaves')
    order by u.name, u.id;
end;
$$;

revoke execute on function public.finished_students() from public, anon;
grant execute on function public.finished_students() to authenticated;

-- Finding a student, as in 5.2a and 5.2d, with their last class up to the year of the class ----------

-- What a teacher sees of a student they do not know before enrolling them: where they come from or
-- where they are, and whether they finished the cycle or left the school there.

drop function public.search_class_students(text, uuid);
create function public.search_class_students(search text, target_class_id uuid)
returns table (
  id uuid,
  name text,
  email text,
  last_class_name text,
  last_school_year text,
  last_outcome public.class_outcome
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pattern text;
  class_year text;
begin
  if not public.manages_class(target_class_id) then
    raise exception 'No such class' using errcode = 'P0002';
  end if;
  if char_length(btrim(coalesce(search, ''))) < 2 then
    raise exception 'The search needs two letters' using errcode = '22023';
  end if;
  select c.school_year into class_year from public.school_class c where c.id = target_class_id;
  pattern := '%' || replace(replace(replace(
    extensions.unaccent(lower(btrim(search))), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query
    select u.id, u.name, u.email, l.name, l.school_year, l.outcome
    from public.app_user u
    left join public.last_class_member(class_year) l on l.user_id = u.id
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

drop function public.search_students(text, uuid);
create function public.search_students(search text, target_group_id uuid)
returns table (
  id uuid,
  name text,
  email text,
  last_class_name text,
  last_school_year text,
  last_outcome public.class_outcome
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pattern text;
  class_year text;
begin
  if not (public.is_admin() or public.teaches_group(target_group_id)) then
    raise exception 'No such group' using errcode = 'P0002';
  end if;
  if char_length(btrim(coalesce(search, ''))) < 2 then
    raise exception 'The search needs two letters' using errcode = '22023';
  end if;
  select c.school_year into class_year
  from public.class_group g join public.school_class c on c.id = g.class_id
  where g.id = target_group_id;
  pattern := '%' || replace(replace(replace(
    extensions.unaccent(lower(btrim(search))), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query
    select u.id, u.name, u.email, l.name, l.school_year, l.outcome
    from public.app_user u
    left join public.last_class_member(class_year) l on l.user_id = u.id
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

-- As in 5.2d, with the last class of each: the screen leaves out who finished the cycle or left the
-- school there, and says so, as a list of secretaría may still name them.
drop function public.match_students(uuid, text[]);
create function public.match_students(target_class_id uuid, entries text[])
returns table (
  entry text,
  id uuid,
  name text,
  email text,
  last_class_name text,
  last_school_year text,
  last_outcome public.class_outcome
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  class_year text;
begin
  if not public.manages_class(target_class_id) then
    raise exception 'No such class' using errcode = 'P0002';
  end if;
  if coalesce(cardinality(entries), 0) > 500 then
    raise exception '500 lines at most' using errcode = '22023';
  end if;
  select c.school_year into class_year from public.school_class c where c.id = target_class_id;
  return query
    with lines as (
      select distinct btrim(e) as entry from unnest(coalesce(entries, '{}')) e where btrim(e) <> ''
    ),
    matches as (
      select l.entry, u.id, u.name, u.email, count(*) over (partition by l.entry) as found
      from lines l
      join public.app_user u
        on u.role = 'student'
        and u.status = 'active'
        and (
          lower(u.email) = lower(l.entry)
          or extensions.unaccent(lower(u.name)) = extensions.unaccent(lower(l.entry))
        )
    )
    select m.entry, m.id, m.name, m.email, l.name, l.school_year, l.outcome
    from matches m
    left join public.last_class_member(class_year) l on l.user_id = m.id
    where m.found = 1
    order by m.name, m.id;
end;
$$;

revoke execute on function
  public.search_class_students(text, uuid),
  public.search_students(text, uuid),
  public.match_students(uuid, text[])
from public, anon;
grant execute on function
  public.search_class_students(text, uuid),
  public.search_students(text, uuid),
  public.match_students(uuid, text[])
to authenticated;

-- One class a year for each student ------------------------------------------------------------------

-- Two classes of the same year left the last class of a student, and so their outcome, to the order
-- of the names. A student is in one class a year: changing class is taking them out of the old one
-- (which keeps their work) and enrolling them in the new one. Taking a subject of another class is
-- enrolling only in its group, which does not make them a student of that class. For every way into
-- a class: enrolling, duplicating with the students, or any direct call.
create function public.check_one_class_a_year()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.class_member m
    join public.school_class other on other.id = m.class_id
    join public.school_class target on target.id = new.class_id
    where m.user_id = new.user_id
      and m.class_id <> new.class_id
      and other.school_year = target.school_year
  ) then
    raise exception 'The student is in another class of that year' using errcode = '23505';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_one_class_a_year() from public, anon, authenticated;

create trigger class_member_one_class_a_year
before insert on public.class_member
for each row execute function public.check_one_class_a_year();
