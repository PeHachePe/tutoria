-- Step 2.5c · Subjects, blocks and practice (docs/PLAN.md §2.3, D-046).
--
-- - Every group belongs to a subject, which only says what is taught: the kind of each exercise
--   decides its editor and how it is checked (D-029), so a subject is not tied to programming.
-- - The numbered sessions of a group become blocks with a free title («Tema 1: Bucles», «Repaso del
--   tema 1»): the position only sorts them. An exercise can be in several blocks of the same group.
-- - Attempts are one per student, assignment and number: the same exercise in a block and in its
--   resit are two attempts, and a submitted one can be practised again with the next number.
-- - Teachers can hide a block or an assignment from their students, to prepare it in advance.

-- Translations of a single text ------------------------------------------------------------------

-- Whether `translations` has the right shape for a name or a title: an object whose keys are
-- languages other than the source one, each with only `field`, a non-blank text. The texts of the
-- exercises have their own check, with statement and topics (step 2.5b).
create function public.is_valid_text_translations(
  translations jsonb,
  source_locale public.app_locale,
  field text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(translations) <> 'object' then false
    when translations ? source_locale::text then false
    else coalesce((
      select bool_and(
        locale = any (enum_range(null::public.app_locale)::text[])
        and jsonb_typeof(translation) = 'object'
        and (select array_agg(key) from jsonb_object_keys(translation) as keys (key)) = array[field]
        and jsonb_typeof(translation -> field) = 'string'
        and btrim(translation ->> field) <> ''
      )
      from jsonb_each(translations) as each_translation (locale, translation)
    ), true)
  end
$$;

-- Subjects ---------------------------------------------------------------------------------------

-- «Programación básica», «Desarrollo web en entorno cliente»…, managed by administrators.
create table public.subject (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  source_locale public.app_locale not null default 'es',
  translations jsonb not null default '{}'
  constraint subject_translations_shape
  check (public.is_valid_text_translations(translations, source_locale, 'name'))
);

-- The groups that exist before this migration have no subject: none outside the local seed, which
-- runs after the migrations.
alter table public.class_group
add column subject_id uuid not null references public.subject (id) on delete restrict;

create index class_group_subject_id_idx on public.class_group (subject_id);

-- The subjects each exercise of the shared bank is meant for, to filter the bank (step 4.3).
create table public.exercise_subject (
  exercise_id uuid not null references public.exercise (id) on delete cascade,
  subject_id uuid not null references public.subject (id) on delete cascade,
  primary key (exercise_id, subject_id)
);

create index exercise_subject_subject_id_idx on public.exercise_subject (subject_id);

-- Blocks -----------------------------------------------------------------------------------------

alter table public.exercise_assignment
drop constraint exercise_assignment_group_id_session_fkey;

alter table public.class_session rename to class_block;
alter table public.class_block rename column number to position;
alter table public.class_block rename constraint class_session_pkey to class_block_pkey;
alter table public.class_block rename constraint class_session_number_check to class_block_position_check;
alter table public.class_block rename constraint class_session_group_id_fkey to class_block_group_id_fkey;
alter table public.class_block drop constraint class_session_group_id_number_key;

update public.class_block set title = 'Sesión ' || position where title is null;

alter table public.class_block
alter column title set not null,
add constraint class_block_title_check check (btrim(title) <> ''),
add column source_locale public.app_locale not null default 'es',
add column translations jsonb not null default '{}'
constraint class_block_translations_shape
check (public.is_valid_text_translations(translations, source_locale, 'title')),
-- Hidden from the students of the group, with all its exercises, until the teacher shows it.
add column is_hidden boolean not null default false,
-- Deferrable, so reordering the blocks in one statement does not clash halfway.
add constraint class_block_group_id_position_key unique (group_id, position) deferrable,
-- The target of the assignments, which keep their group to check it matches.
add constraint class_block_group_id_id_key unique (group_id, id);

-- Assignments: in a block instead of a session number ---------------------------------------------

alter table public.exercise_assignment
add column block_id uuid,
-- Hidden from the students, as the whole block can be.
add column is_hidden boolean not null default false;

update public.exercise_assignment a
set block_id = b.id
from public.class_block b
where b.group_id = a.group_id and b.position = a.session;

-- Dropping the session drops its unique constraint too.
alter table public.exercise_assignment
drop column session,
alter column block_id set not null,
add constraint exercise_assignment_block_id_exercise_id_key unique (block_id, exercise_id),
-- A block with exercises cannot be deleted, and it is always one of the group of the assignment.
add constraint exercise_assignment_block_fkey foreign key (group_id, block_id)
  references public.class_block (group_id, id);

create index exercise_assignment_group_id_block_id_idx
on public.exercise_assignment (group_id, block_id);

-- Attempts: one per student, assignment and number ----------------------------------------------

alter table public.attempt
drop constraint attempt_user_id_exercise_id_key,
-- 1 counts for the class; the next ones are practice, once the previous one is submitted.
add column number integer not null default 1 check (number > 0),
-- Two tabs never open two attempts with the same number (open_attempt, retry_attempt).
add constraint attempt_user_id_assignment_id_number_key unique (user_id, assignment_id, number);

create index attempt_user_id_idx on public.attempt (user_id);

-- Row level security -----------------------------------------------------------------------------

grant select, insert, update, delete on public.subject to authenticated;
grant select, insert, delete on public.exercise_subject to authenticated;

alter table public.subject enable row level security;
alter table public.exercise_subject enable row level security;

-- subject: their names are no secret, and every group screen shows them.

create policy "Signed-in users read the subjects"
on public.subject for select to authenticated
using (public.current_app_role() is not null);

create policy "Admins manage the subjects"
on public.subject for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- exercise_subject: part of the bank, shared by every teacher

create policy "Staff read the subjects of the exercises"
on public.exercise_subject for select to authenticated
using (public.is_staff());

create policy "Staff manage the subjects of the exercises"
on public.exercise_subject for all to authenticated
using (public.is_staff())
with check (public.is_staff());

-- class_block: students do not see the hidden ones

drop policy "Members read the sessions of their groups" on public.class_block;
drop policy "Teachers manage the sessions of their groups" on public.class_block;

create policy "Staff read the blocks of their groups; students, the visible ones"
on public.class_block for select to authenticated
using (
  public.is_admin()
  or public.teaches_group(group_id)
  or (not is_hidden and public.is_enrolled(group_id))
);

create policy "Teachers manage the blocks of their groups"
on public.class_block for all to authenticated
using (public.is_admin() or public.teaches_group(group_id))
with check (public.is_admin() or public.teaches_group(group_id));

-- exercise_assignment: neither the hidden ones nor those of a hidden block

-- The assignment is shown to its students: neither it nor its block is hidden.
create function public.is_visible_assignment(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.exercise_assignment a
    join public.class_block b on b.id = a.block_id
    where a.id = target_assignment_id and not a.is_hidden and not b.is_hidden
  );
$$;

-- The signed-in user can open attempts at the assignment: a student of its group who sees it, its
-- teacher or an administrator.
create function public.can_open_assignment(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.exercise_assignment a
    where a.id = target_assignment_id
      and (
        public.is_admin()
        or public.teaches_group(a.group_id)
        or (public.is_enrolled(a.group_id) and public.is_visible_assignment(a.id))
      )
  );
$$;

drop policy "Members read the assignments of their groups" on public.exercise_assignment;

create policy "Staff read the assignments of their groups; students, the visible ones"
on public.exercise_assignment for select to authenticated
using (
  public.is_admin()
  or public.teaches_group(group_id)
  or (public.is_enrolled(group_id) and public.is_visible_assignment(id))
);

-- The exercise is assigned to a group the signed-in user is enrolled in, where they see it.
create or replace function public.is_assigned_to_me(target_exercise_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_app_role() is not null and exists (
    select 1 from public.exercise_assignment a
    join public.enrollment e on e.group_id = a.group_id
    where a.exercise_id = target_exercise_id
      and e.user_id = (select auth.uid())
      and public.is_visible_assignment(a.id)
  );
$$;

revoke execute on function
  public.is_visible_assignment(uuid),
  public.can_open_assignment(uuid)
from public, anon;

grant execute on function
  public.is_visible_assignment(uuid),
  public.can_open_assignment(uuid)
to authenticated;

-- open_attempt and retry_attempt -----------------------------------------------------------------

-- The exercises are opened from an assignment now; teachers will try them from the bank (step 4.3).
drop function public.open_attempt(uuid);

-- The attempt of the signed-in user at the assignment: number `attempt_number` or, without it, the
-- latest, created as number 1 on first opening. Two tabs at once get the same attempt, thanks to the
-- unique (user_id, assignment_id, number).
create function public.open_attempt(target_assignment_id uuid, attempt_number integer default null)
returns public.attempt
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  result public.attempt;
begin
  if public.current_app_role() is null or not public.can_open_assignment(target_assignment_id) then
    raise exception 'Assignment not found' using errcode = 'P0002';
  end if;

  if attempt_number is null then
    insert into public.attempt (exercise_id, user_id, assignment_id, number)
    select exercise_id, (select auth.uid()), id, 1
    from public.exercise_assignment
    where id = target_assignment_id
    on conflict (user_id, assignment_id, number) do nothing;
  end if;

  select * into result
  from public.attempt
  where user_id = (select auth.uid())
    and assignment_id = target_assignment_id
    and number = coalesce(attempt_number, number)
  order by number desc
  limit 1;

  if result.id is null then
    raise exception 'Attempt not found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

-- «Practicar de nuevo»: a new attempt at the assignment, with the next number and the editor empty,
-- once the latest is submitted. If the latest is still open (another tab practised first), it is
-- that one: two tabs never start two.
create function public.retry_attempt(target_assignment_id uuid)
returns public.attempt
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  latest public.attempt;
  result public.attempt;
begin
  if public.current_app_role() is null or not public.can_open_assignment(target_assignment_id) then
    raise exception 'Assignment not found' using errcode = 'P0002';
  end if;

  select * into latest
  from public.attempt
  where user_id = (select auth.uid()) and assignment_id = target_assignment_id
  order by number desc
  limit 1;

  if latest.id is null then
    raise exception 'Only a submitted attempt can be practised again' using errcode = 'P0001';
  end if;
  if latest.status <> 'submitted' then
    return latest;
  end if;

  insert into public.attempt (exercise_id, user_id, assignment_id, number)
  values (latest.exercise_id, latest.user_id, target_assignment_id, latest.number + 1)
  on conflict (user_id, assignment_id, number) do nothing;

  select * into result
  from public.attempt
  where user_id = (select auth.uid())
    and assignment_id = target_assignment_id
    and number = latest.number + 1;
  return result;
end;
$$;

revoke execute on function
  public.open_attempt(uuid, integer),
  public.retry_attempt(uuid)
from public, anon;

grant execute on function
  public.open_attempt(uuid, integer),
  public.retry_attempt(uuid)
to authenticated;
