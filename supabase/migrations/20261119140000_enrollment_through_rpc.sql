-- Step 5.2a, second review · Students are only enrolled through `enroll_students` (docs/PLAN.md
-- §2.3, D-072): an insert of the table skipped its limit of 50 different students per request.

drop policy "Teachers enroll students in their groups" on public.enrollment;
revoke insert on public.enrollment from authenticated;

-- Security definer, as the only way in: it checks the group itself, and `check_enrolled_student`
-- still rejects anybody who is not an active student (`23514`).
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
