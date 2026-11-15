-- Step 4.3d · More about blocks (docs/PLAN.md §2.3, D-060).
--
-- - A block may open on a date (`class_block.opens_at`): until then its students do not see it, as
--   if it were hidden, so a resit appears by itself on the day of the exam. The RLS enforces it.
-- - An exercise with attempts is archived instead of deleted (`exercise.archived_at`): it leaves the
--   bank, while its assignments and the attempts at them stay.
-- - An exercise moves to another block of the group (`move_assignment`), started or not: the
--   attempts point to the assignment, so nobody loses their work.

-- Opening date ------------------------------------------------------------------------------------

alter table public.class_block add column opens_at timestamptz;

drop policy "Staff read the blocks of their groups; students, the visible ones" on public.class_block;

create policy "Staff read the blocks of their groups; students, the open ones"
on public.class_block for select to authenticated
using (
  public.is_admin()
  or public.teaches_group(group_id)
  or (
    not is_hidden
    and (opens_at is null or opens_at <= now())
    and public.is_enrolled(group_id)
  )
);

-- The assignment is shown to its students: it is not hidden, and its block is neither hidden nor
-- waiting for its opening date.
create or replace function public.is_visible_assignment(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.exercise_assignment a
    join public.class_block b on b.id = a.block_id
    where a.id = target_assignment_id
      and not a.is_hidden
      and not b.is_hidden
      and (b.opens_at is null or b.opens_at <= now())
  );
$$;

-- `create_block` takes the opening date too.
drop function public.create_block(uuid, text, public.app_locale, jsonb, boolean);

create function public.create_block(
  target_group_id uuid,
  block_title text,
  block_source_locale public.app_locale,
  block_translations jsonb,
  block_is_hidden boolean,
  block_opens_at timestamptz default null
)
returns public.class_block
language sql
set search_path = ''
as $$
  insert into public.class_block (
    group_id, position, title, source_locale, translations, is_hidden, opens_at
  )
  select target_group_id, coalesce(max(position), 0) + 1, block_title, block_source_locale,
    block_translations, block_is_hidden, block_opens_at
  from public.class_block where group_id = target_group_id
  returning *;
$$;

revoke execute on function
  public.create_block(uuid, text, public.app_locale, jsonb, boolean, timestamptz)
from public, anon;
grant execute on function
  public.create_block(uuid, text, public.app_locale, jsonb, boolean, timestamptz)
to authenticated;

-- Archived exercises -----------------------------------------------------------------------------

alter table public.exercise add column archived_at timestamptz;

-- Who archives it is who edits it (`Authors and admins edit exercises`).
grant update (archived_at) on public.exercise to authenticated;

-- Moving an exercise to another block -------------------------------------------------------------

-- Moves the assignment to `target_position` (1 to the last plus one) of another block of its group,
-- closing the gap it leaves. Security invoker: the RLS decides, so only the teacher of the group or
-- the administration moves it. An exercise is only once in a block (23505).
create function public.move_assignment(
  target_assignment_id uuid,
  target_block_id uuid,
  target_position integer
)
returns public.exercise_assignment
language plpgsql
set search_path = ''
as $$
declare
  source public.exercise_assignment;
  moved public.exercise_assignment;
begin
  -- The RLS hides the assignments of another teacher's groups
  select * into source from public.exercise_assignment where id = target_assignment_id;
  if not found then
    raise exception 'No such assignment' using errcode = 'P0002';
  end if;

  if source.block_id = target_block_id then
    raise exception 'The assignment is already in the block: reorder it' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.class_block where id = target_block_id and group_id = source.group_id
  ) then
    raise exception 'The block is not one of the group' using errcode = 'P0002';
  end if;

  if target_position < 1 or target_position > 1 + (
    select count(*) from public.exercise_assignment where block_id = target_block_id
  ) then
    raise exception 'No such position in the block' using errcode = '22023';
  end if;

  set constraints public.exercise_assignment_block_id_position_key deferred;

  -- Closes the gap in the block it leaves and makes room in the other
  update public.exercise_assignment
  set position = position - 1
  where block_id = source.block_id and position > source.position;

  update public.exercise_assignment
  set position = position + 1
  where block_id = target_block_id and position >= target_position;

  update public.exercise_assignment
  set block_id = target_block_id, position = target_position
  where id = target_assignment_id
  returning * into moved;

  if not found then
    raise exception 'The assignment is not yours to move' using errcode = '42501';
  end if;

  return moved;
end;
$$;

revoke execute on function public.move_assignment(uuid, uuid, integer) from public, anon;
grant execute on function public.move_assignment(uuid, uuid, integer) to authenticated;
