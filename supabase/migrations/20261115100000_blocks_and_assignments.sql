-- Step 4.3b · Blocks and assignments of a group (docs/PLAN.md §2.3, D-046, D-054, D-058).
--
-- - The exercises of a block keep the order the teacher gives them (`exercise_assignment.position`),
--   and each assignment may have a due date (`due_at`), which the students see in the catalog.
-- - A new block or assignment goes last (`create_block`, `assign_exercises`), counted on the server.
-- - `reorder_blocks` and `reorder_assignments` write a new order in one transaction.
-- - Only what nobody has started is deleted: the attempts of a student are their work, and the
--   teacher hides what should not be seen any more. A block is deleted with its assignments.

-- Order and due date ------------------------------------------------------------------------------

alter table public.exercise_assignment
add column position integer,
add column due_at timestamptz;

-- Until now the assignments of a block went by their id (2.5c).
update public.exercise_assignment a
set position = ordered.position
from (
  select id, row_number() over (partition by block_id order by id) as position
  from public.exercise_assignment
) ordered
where ordered.id = a.id;

alter table public.exercise_assignment
alter column position set not null,
add constraint exercise_assignment_position_check check (position > 0),
-- Deferrable, like that of the blocks, so a new order does not clash halfway.
add constraint exercise_assignment_block_id_position_key unique (block_id, position) deferrable;

-- Adding last -----------------------------------------------------------------------------------

-- Creates a block at the end of the group. Security invoker: the RLS decides, so only the teacher
-- of the group or the administration adds it.
create function public.create_block(
  target_group_id uuid,
  block_title text,
  block_source_locale public.app_locale,
  block_translations jsonb,
  block_is_hidden boolean
)
returns public.class_block
language sql
set search_path = ''
as $$
  insert into public.class_block (group_id, position, title, source_locale, translations, is_hidden)
  select target_group_id, coalesce(max(position), 0) + 1, block_title, block_source_locale,
    block_translations, block_is_hidden
  from public.class_block where group_id = target_group_id
  returning *;
$$;

-- Assigns the exercises at the end of the block, in the order given.
create function public.assign_exercises(target_block_id uuid, exercise_ids uuid[])
returns setof public.exercise_assignment
language sql
set search_path = ''
as $$
  insert into public.exercise_assignment (group_id, block_id, exercise_id, position)
  select b.group_id, b.id, chosen.id,
    (select coalesce(max(a.position), 0) from public.exercise_assignment a where a.block_id = b.id)
      + chosen.position
  from public.class_block b
  cross join unnest(exercise_ids) with ordinality as chosen (id, position)
  where b.id = target_block_id
  order by chosen.position
  returning *;
$$;

-- Reordering --------------------------------------------------------------------------------------

-- Gives the blocks of the group the order of `block_ids`, which must be all of them. Security
-- invoker: the RLS decides, so only the teacher of the group or the administration reorders it.
create function public.reorder_blocks(target_group_id uuid, block_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.class_block where group_id = target_group_id)
     <> cardinality(block_ids)
     or cardinality(block_ids) <> (select count(distinct id) from unnest(block_ids) as ids (id)) then
    raise exception 'The new order must have every block of the group once'
      using errcode = '22023';
  end if;

  set constraints public.class_block_group_id_position_key deferred;

  update public.class_block b
  set position = ordered.position
  from unnest(block_ids) with ordinality as ordered (id, position)
  where b.id = ordered.id and b.group_id = target_group_id;

  -- A block of another group, or one the user cannot change, leaves rows without update
  if not found or (
    select count(*) from public.class_block b
    join unnest(block_ids) with ordinality as ordered (id, position) on ordered.id = b.id
    where b.group_id = target_group_id and b.position = ordered.position
  ) <> cardinality(block_ids) then
    raise exception 'The blocks are not those of the group' using errcode = '42501';
  end if;
end;
$$;

-- Gives the assignments of the block the order of `assignment_ids`, which must be all of them.
create function public.reorder_assignments(target_block_id uuid, assignment_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.exercise_assignment where block_id = target_block_id)
     <> cardinality(assignment_ids)
     or cardinality(assignment_ids)
       <> (select count(distinct id) from unnest(assignment_ids) as ids (id)) then
    raise exception 'The new order must have every assignment of the block once'
      using errcode = '22023';
  end if;

  set constraints public.exercise_assignment_block_id_position_key deferred;

  update public.exercise_assignment a
  set position = ordered.position
  from unnest(assignment_ids) with ordinality as ordered (id, position)
  where a.id = ordered.id and a.block_id = target_block_id;

  if not found or (
    select count(*) from public.exercise_assignment a
    join unnest(assignment_ids) with ordinality as ordered (id, position) on ordered.id = a.id
    where a.block_id = target_block_id and a.position = ordered.position
  ) <> cardinality(assignment_ids) then
    raise exception 'The assignments are not those of the block' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function
  public.create_block(uuid, text, public.app_locale, jsonb, boolean),
  public.assign_exercises(uuid, uuid[]),
  public.reorder_blocks(uuid, uuid[]),
  public.reorder_assignments(uuid, uuid[])
from public, anon;

grant execute on function
  public.create_block(uuid, text, public.app_locale, jsonb, boolean),
  public.assign_exercises(uuid, uuid[]),
  public.reorder_blocks(uuid, uuid[]),
  public.reorder_assignments(uuid, uuid[])
to authenticated;

-- How many students started each assignment of a group, practice aside: what keeps it. Security
-- invoker: a teacher only counts the attempts of their groups.
create function public.assignment_student_counts(target_group_id uuid)
returns table (assignment_id uuid, student_count integer)
language sql
stable
set search_path = ''
as $$
  select a.id, count(distinct t.user_id)::integer
  from public.exercise_assignment a
  join public.attempt t on t.assignment_id = a.id
  where a.group_id = target_group_id
  group by a.id;
$$;

revoke execute on function public.assignment_student_counts(uuid) from public, anon;
grant execute on function public.assignment_student_counts(uuid) to authenticated;

-- Deleting only what nobody started ---------------------------------------------------------------

-- Whether a student has opened the assignment: then their attempts keep it.
create function public.is_started_assignment(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.attempt where assignment_id = target_assignment_id);
$$;

-- Whether a student has opened any assignment of the block.
create function public.is_started_block(target_block_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.attempt t
    join public.exercise_assignment a on a.id = t.assignment_id
    where a.block_id = target_block_id
  );
$$;

revoke execute on function
  public.is_started_assignment(uuid),
  public.is_started_block(uuid)
from public, anon;

grant execute on function
  public.is_started_assignment(uuid),
  public.is_started_block(uuid)
to authenticated;

-- The policies only stop what the teacher deletes: deleting a group or an exercise cascades without
-- them, as foreign keys skip the RLS.
drop policy "Teachers manage the assignments of their groups" on public.exercise_assignment;

create policy "Teachers add assignments to their groups"
on public.exercise_assignment for insert to authenticated
with check (public.is_admin() or public.teaches_group(group_id));

create policy "Teachers change the assignments of their groups"
on public.exercise_assignment for update to authenticated
using (public.is_admin() or public.teaches_group(group_id))
with check (public.is_admin() or public.teaches_group(group_id));

create policy "Teachers delete the assignments nobody started"
on public.exercise_assignment for delete to authenticated
using (
  (public.is_admin() or public.teaches_group(group_id))
  and not public.is_started_assignment(id)
);

drop policy "Teachers manage the blocks of their groups" on public.class_block;

create policy "Teachers add blocks to their groups"
on public.class_block for insert to authenticated
with check (public.is_admin() or public.teaches_group(group_id));

create policy "Teachers change the blocks of their groups"
on public.class_block for update to authenticated
using (public.is_admin() or public.teaches_group(group_id))
with check (public.is_admin() or public.teaches_group(group_id));

create policy "Teachers delete the blocks nobody started"
on public.class_block for delete to authenticated
using ((public.is_admin() or public.teaches_group(group_id)) and not public.is_started_block(id));

-- A block goes with its assignments, which the policy above has checked.
alter table public.exercise_assignment
drop constraint exercise_assignment_block_fkey,
add constraint exercise_assignment_block_fkey foreign key (group_id, block_id)
  references public.class_block (group_id, id) on delete cascade;
