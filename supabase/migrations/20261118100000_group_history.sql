-- Step 4.5 · The history of a group with real data (docs/PLAN.md §2.1, ficha 09, D-073): what its
-- students did in each block and in each of its exercises, and what arrived for each due date. The
-- same rules as `groupHistoryOf()` of the mock data, which the tests of both check with the seed.
--
-- Both functions are `security definer` and check who calls first: counting under the row level
-- security would call `can_read_attempt()` for every event of the group. They only give counts and
-- the names of the students of the group, which its teacher already reads. A group the user does not
-- teach is `P0002`, that the client reads as `not_found`, as the mock data answer.

-- One row per block of the group, in order, also those nobody started, and one per assignment that
-- counts, after its block and in its order: `id` is the block or the assignment, and `is_block`
-- says which. Grouping sets count both with the same rules, written once. Of those enrolled now, the
-- attempt that counts of each student and assignment, as `countedAttempt()`: the first submitted
-- or, while none is, the first; practice does not change the data of the class (D-046). An
-- assignment counts if its students see it or somebody worked on it. A median that does not exist
-- is 0, because the generated types do not know a column of a function may be null, and no
-- submitted attempt takes no time.
create function public.group_work_stats(target_group_id uuid)
returns table (
  id uuid,
  block_id uuid,
  is_block boolean,
  students integer,
  assignments integer,
  attempts integer,
  active_students integer,
  hints integer,
  solved integer,
  median_seconds integer,
  stuck_students integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or coalesce(public.teaches_group(target_group_id), false)) then
    raise exception 'Group not found' using errcode = 'P0002';
  end if;
  return query
  with enrolled as (
    select e.user_id from public.enrollment e where e.group_id = target_group_id
  ),
  counted as (
    select distinct on (t.user_id, t.assignment_id)
      t.id, t.user_id, t.assignment_id, t.status, t.started_at, t.finished_at
    from public.attempt t
    join public.exercise_assignment a on a.id = t.assignment_id
    join enrolled e on e.user_id = t.user_id
    where a.group_id = target_group_id
    order by t.user_id, t.assignment_id, (t.status = 'submitted') desc, t.number
  ),
  counted_assignment as (
    select a.id, a.block_id, a.exercise_id, a.position
    from public.exercise_assignment a
    where a.group_id = target_group_id
      and (not a.is_hidden or exists (select 1 from counted c where c.assignment_id = a.id))
  ),
  -- The runs of each attempt, in order, and the tests each failed (`record_run`). Consecutive runs
  -- failing one same test are an island: its number minus the position among the runs where that
  -- test failed stays the same along it. The longest island of an attempt is its longest streak,
  -- as `longestFailureStreak()`.
  run as (
    select c.id as attempt_id, p.detail,
      row_number() over (partition by c.id order by p.timestamp, p.id) as run_number
    from counted c
    join public.process_event p on p.attempt_id = c.id and p.type = 'run'
  ),
  failure as (
    select r.attempt_id, failed.test_id,
      r.run_number - row_number() over (
        partition by r.attempt_id, failed.test_id order by r.run_number
      ) as island
    from run r
    cross join lateral jsonb_array_elements_text(r.detail -> 'failedTestIds') as failed(test_id)
  ),
  streak as (
    select i.attempt_id, max(i.runs) as longest
    from (
      select f.attempt_id, count(*) as runs
      from failure f
      group by f.attempt_id, f.test_id, f.island
    ) i
    group by i.attempt_id
  ),
  hint as (
    select p.attempt_id, count(*) as requested
    from public.process_event p
    join counted c on c.id = p.attempt_id
    where p.type = 'hint_requested'
    group by p.attempt_id
  )
  select
    coalesce(a.id, b.id),
    b.id,
    grouping(a.id) = 1,
    (select count(*) from enrolled)::integer,
    count(distinct a.id)::integer,
    count(c.id)::integer,
    count(distinct c.user_id)::integer,
    coalesce(sum(h.requested), 0)::integer,
    (count(c.id) filter (where c.status in ('passed', 'submitted')))::integer,
    coalesce(
      round(
        (percentile_cont(0.5) within group (
          order by extract(epoch from c.finished_at - c.started_at)
        ) filter (where c.status = 'submitted'))::numeric
      ),
      0
    )::integer,
    (count(distinct c.user_id) filter (where s.longest >= x.max_repeated_failures))::integer
  from public.class_block b
  left join counted_assignment a on a.block_id = b.id
  left join public.exercise x on x.id = a.exercise_id
  left join counted c on c.assignment_id = a.id
  left join hint h on h.attempt_id = c.id
  left join streak s on s.attempt_id = c.id
  where b.group_id = target_group_id
  group by grouping sets ((b.id, b.position), (b.id, b.position, a.id, a.position))
  -- The set of the assignments gives a row without one for a block that has none.
  having grouping(a.id) = 1 or a.id is not null
  order by b.position, grouping(a.id) desc, a.position;
end;
$$;

revoke execute on function public.group_work_stats(uuid) from public, anon;
grant execute on function public.group_work_stats(uuid) to authenticated;

-- One row per due date of a block, counting the assignments its students see now and those
-- enrolled now: what was submitted up to the date (and, of that, in its last hours) and after it,
-- and who has something pending, by name. Their ids, names and pending counts go in three parallel
-- arrays of the row, so no answer comes close to the limit of 1000 rows of PostgREST.
create function public.group_deadline_stats(target_group_id uuid)
returns table (
  block_id uuid,
  due_at timestamptz,
  assignments integer,
  on_time integer,
  last_hours integer,
  late integer,
  missing_ids uuid[],
  missing_names text[],
  missing_pending integer[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or coalesce(public.teaches_group(target_group_id), false)) then
    raise exception 'Group not found' using errcode = 'P0002';
  end if;
  return query
  with dated as (
    select a.id, a.block_id, a.due_at
    from public.exercise_assignment a
    where a.group_id = target_group_id
      and a.due_at is not null
      and public.is_visible_assignment(a.id)
  ),
  delivery as (
    select d.block_id, d.due_at, u.id as user_id, u.name,
      (
        select t.finished_at from public.attempt t
        where t.assignment_id = d.id and t.user_id = u.id and t.status = 'submitted'
        order by t.number
        limit 1
      ) as submitted_at
    from dated d
    join public.enrollment e on e.group_id = target_group_id
    join public.app_user u on u.id = e.user_id
  ),
  per_student as (
    select v.block_id, v.due_at, v.user_id, v.name,
      count(*) filter (where v.submitted_at is null) as pending,
      count(*) filter (where v.submitted_at <= v.due_at) as on_time,
      -- The interval is `DEADLINE_LAST_HOURS` (src/app/data/stats-service.ts): if one changes, so
      -- does the other.
      count(*) filter (
        where v.submitted_at <= v.due_at and v.submitted_at > v.due_at - interval '24 hours'
      ) as last_hours,
      count(*) filter (where v.submitted_at > v.due_at) as late
    from delivery v
    group by v.block_id, v.due_at, v.user_id, v.name
  )
  select
    p.block_id,
    p.due_at,
    (select count(*) from dated d where d.block_id = p.block_id and d.due_at = p.due_at)::integer,
    sum(p.on_time)::integer,
    sum(p.last_hours)::integer,
    sum(p.late)::integer,
    coalesce(array_agg(p.user_id order by p.name, p.user_id) filter (where p.pending > 0), '{}'),
    coalesce(array_agg(p.name order by p.name, p.user_id) filter (where p.pending > 0), '{}'),
    coalesce(
      array_agg(p.pending::integer order by p.name, p.user_id) filter (where p.pending > 0),
      '{}'
    )
  from per_student p
  group by p.block_id, p.due_at
  order by p.due_at, p.block_id;
end;
$$;

revoke execute on function public.group_deadline_stats(uuid) from public, anon;
grant execute on function public.group_deadline_stats(uuid) to authenticated;
