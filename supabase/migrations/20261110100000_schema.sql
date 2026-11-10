-- Step 2.1 · Types and tables of the data model (docs/PLAN.md §2.3).
--
-- Deletion rules, the same the mock services apply: a group takes its enrollments, sessions and
-- assignments with it; unassigning an exercise keeps its attempts (`assignment_id` becomes null);
-- an exercise with attempts cannot be deleted, so its history stays.

-- Types ----------------------------------------------------------------------------------------

create type public.user_role as enum ('student', 'teacher', 'admin');
create type public.user_status as enum ('active', 'disabled');
create type public.difficulty as enum ('initial', 'medium', 'advanced', 'extension');
-- Only code exercises for now; other kinds (multiple choice, numeric answer…) are future work (D-029).
create type public.exercise_kind as enum ('code');
create type public.exercise_language as enum ('javascript');
-- `not_started` is never stored: it describes an exercise without an attempt (§2.4).
create type public.attempt_status as enum ('in_progress', 'tests_failed', 'passed', 'submitted');
create type public.tutor_trigger as enum ('question', 'hint', 'proactive');
create type public.emotion as enum ('joy', 'surprise', 'encouragement', 'celebration');
create type public.process_event_type as enum (
  'run',
  'submit',
  'hint_requested',
  'proactive_intervention',
  'paste',
  'focus_lost',
  'focus_gained'
);

-- updated_at -----------------------------------------------------------------------------------

-- Every update moves `updated_at` to now, unless the update sets it itself: the seed keeps the
-- dates of the fixtures. Clients cannot write `updated_at` (column privileges, next migration).
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- Users and groups -----------------------------------------------------------------------------

create table public.app_user (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  email text not null unique,
  role public.user_role not null default 'student',
  status public.user_status not null default 'active',
  -- When the student accepted the data notice (RF-07): proof that they were informed (GDPR art. 13).
  privacy_notice_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger app_user_updated_at
before update on public.app_user
for each row execute function public.set_updated_at();

create table public.class_group (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  -- For example, `2026/27`.
  school_year text not null,
  teacher_id uuid not null references public.app_user (id) on delete restrict
);

create index class_group_teacher_id_idx on public.class_group (teacher_id);

create table public.enrollment (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.class_group (id) on delete cascade,
  user_id uuid not null references public.app_user (id) on delete cascade,
  unique (group_id, user_id)
);

create index enrollment_user_id_idx on public.enrollment (user_id);

-- The class sessions of each group, with the title the teacher gives them (D-034).
create table public.class_session (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.class_group (id) on delete cascade,
  number integer not null check (number > 0),
  -- Without a title, the screens show «Sesión N».
  title text,
  unique (group_id, number)
);

-- Exercises and tests --------------------------------------------------------------------------

create table public.exercise (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> ''),
  statement text not null,
  difficulty public.difficulty not null,
  -- What the exercise practises, shown under its title in the catalog (D-027).
  topics text[] not null default '{}',
  kind public.exercise_kind not null default 'code',
  language public.exercise_language not null default 'javascript',
  -- The function the student writes; every test calls it.
  function_name text not null check (function_name ~ '^[A-Za-z_$][A-Za-z0-9_$]*$'),
  -- Thresholds of the proactive tutor (§2.7).
  max_repeated_failures integer not null default 3 check (max_repeated_failures > 0),
  max_idle_minutes integer not null default 4 check (max_idle_minutes > 0),
  created_by uuid not null references public.app_user (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index exercise_created_by_idx on public.exercise (created_by);

create trigger exercise_updated_at
before update on public.exercise
for each row execute function public.set_updated_at();

create table public.test (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercise (id) on delete cascade,
  -- The list of arguments of the call: a single array argument goes inside another list.
  input jsonb not null check (jsonb_typeof(input) = 'array'),
  -- Compared with the returned value as JSON; the JSON value null is a valid expectation.
  expected_output jsonb not null,
  -- Students only learn whether a hidden test passed.
  is_hidden boolean not null default false,
  position integer not null,
  -- Deferrable, so reordering the tests in one statement does not clash halfway.
  unique (exercise_id, position) deferrable
);

create table public.exercise_assignment (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.class_group (id) on delete cascade,
  exercise_id uuid not null references public.exercise (id) on delete cascade,
  session integer not null,
  unique (group_id, exercise_id, session),
  -- A session with exercises cannot be deleted; renumbering it moves them along (D-034).
  foreign key (group_id, session) references public.class_session (group_id, number)
    on update cascade
);

create index exercise_assignment_exercise_id_idx on public.exercise_assignment (exercise_id);

-- Attempts and what happens in them ------------------------------------------------------------

create table public.attempt (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercise (id) on delete restrict,
  user_id uuid not null references public.app_user (id) on delete cascade,
  -- The assignment the attempt was opened from; null once unassigned.
  assignment_id uuid references public.exercise_assignment (id) on delete set null,
  -- Empty at first: the editor shows how to start as a placeholder.
  current_code text not null default '',
  -- Frozen on submission.
  final_code text,
  status public.attempt_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  -- One attempt per student and exercise: two tabs never open two (open_attempt).
  unique (user_id, exercise_id),
  constraint attempt_submitted_is_final check (
    status <> 'submitted' or (final_code is not null and finished_at is not null)
  )
);

create index attempt_exercise_id_idx on public.attempt (exercise_id);
create index attempt_assignment_id_idx on public.attempt (assignment_id);

create trigger attempt_updated_at
before update on public.attempt
for each row execute function public.set_updated_at();

-- Written only by the server (Edge Function `tutor`, step 2.4).
create table public.tutor_interaction (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempt (id) on delete cascade,
  trigger public.tutor_trigger not null,
  hint_level smallint not null check (hint_level between 1 and 3),
  -- What the student wrote or said; null for proactive interventions.
  student_message text,
  transcript text not null,
  emotion public.emotion not null,
  intensity smallint not null check (intensity between 1 and 3),
  -- The student tried to get the solution.
  elusion boolean not null default false,
  prompt_version text not null,
  created_at timestamptz not null default now()
);

create index tutor_interaction_attempt_id_idx on public.tutor_interaction (attempt_id, created_at);

-- Read with a formative purpose: they describe behaviour, they do not prove fraud (§2.8).
create table public.process_event (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempt (id) on delete cascade,
  type public.process_event_type not null,
  -- When it happened, as the browser or the server says.
  timestamp timestamptz not null default now(),
  -- JSON null for the events without detail.
  detail jsonb,
  -- When it reached the database: the client can fake `timestamp`, not this.
  received_at timestamptz not null default now()
);

create index process_event_attempt_id_idx on public.process_event (attempt_id, timestamp);

-- System settings --------------------------------------------------------------------------------

-- Only `ai_provider` for now: base URL and model of the active AI adapter. The provider key is
-- never stored here, only in the secrets of the Edge Functions.
create table public.app_setting (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create trigger app_setting_updated_at
before update on public.app_setting
for each row execute function public.set_updated_at();
