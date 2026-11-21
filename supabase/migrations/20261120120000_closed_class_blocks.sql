-- Step 5.2f · The blocks of a closed class, read only (docs/PLAN.md §2.3, D-082).
-- The blocks of a class of a past year are what its students had: changing them would change the
-- history of that year. Nobody adds, changes, reorders or deletes its blocks and assignments; they
-- are still read and copied into another group, which is how they are used again. As the rest of the
-- class, they are open again while the administration reopens it.
--
-- The functions that write them are security invoker (`create_block`, `assign_exercises`,
-- `reorder_blocks`, `reorder_assignments`, `move_assignment`): the policies stop them with `42501`.
-- `copy_blocks`, security definer, checks the group it copies into itself.

-- Row level security: the writes, only in a group of an open class -----------------------------------

drop policy "Teachers add blocks to their groups" on public.class_block;
create policy "Teachers add blocks to their open groups"
on public.class_block for insert to authenticated
with check ((public.is_admin() or public.teaches_group(group_id)) and public.is_open_group(group_id));

drop policy "Teachers change the blocks of their groups" on public.class_block;
create policy "Teachers change the blocks of their open groups"
on public.class_block for update to authenticated
using ((public.is_admin() or public.teaches_group(group_id)) and public.is_open_group(group_id))
with check ((public.is_admin() or public.teaches_group(group_id)) and public.is_open_group(group_id));

drop policy "Teachers delete the blocks nobody started" on public.class_block;
create policy "Teachers delete the blocks of their open groups nobody started"
on public.class_block for delete to authenticated
using (
  (public.is_admin() or public.teaches_group(group_id))
  and not public.is_started_block(id)
  and public.is_open_group(group_id)
);

drop policy "Teachers add assignments to their groups" on public.exercise_assignment;
create policy "Teachers add assignments to their open groups"
on public.exercise_assignment for insert to authenticated
with check ((public.is_admin() or public.teaches_group(group_id)) and public.is_open_group(group_id));

drop policy "Teachers change the assignments of their groups" on public.exercise_assignment;
create policy "Teachers change the assignments of their open groups"
on public.exercise_assignment for update to authenticated
using ((public.is_admin() or public.teaches_group(group_id)) and public.is_open_group(group_id))
with check ((public.is_admin() or public.teaches_group(group_id)) and public.is_open_group(group_id));

drop policy "Teachers delete the assignments nobody started" on public.exercise_assignment;
create policy "Teachers delete the assignments of their open groups nobody started"
on public.exercise_assignment for delete to authenticated
using (
  (public.is_admin() or public.teaches_group(group_id))
  and not public.is_started_assignment(id)
  and public.is_open_group(group_id)
);

-- Copying blocks: from any group of the caller, into an open one --------------------------------------

-- As in 5.2d, and the group copied into must be of an open class (`42501`, as the RLS). The source
-- may be closed: the blocks of last year are copied into this one.
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
  if not public.is_open_group(target_group_id) then
    raise exception 'The class is of a past year' using errcode = '42501';
  end if;
  return public.copy_group_blocks(
    source_group_id,
    target_group_id,
    case when with_dates then public.school_year_shift_days(source_year, target_year) end,
    time_zone
  );
end;
$$;
