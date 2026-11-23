-- Step 7.0a · What each user saw and did of the guided help (docs/PLAN.md 2.12, D-080): the version
-- of the welcome of their area, the guided tasks they finished with their date and whether they hid
-- the first steps. It only spares them the same help twice, also on another device.
--
-- A table of its own instead of a column of `app_user`: teachers read the `app_user` rows of their
-- students and the administration reads them all, and what someone saw of the help is nobody else's
-- business. Only its owner reads and writes their row.

create table public.user_guide_state (
  user_id uuid primary key references public.app_user (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  -- The three keys the app writes, with their types: unknown task ids are simply ignored by the app,
  -- so new or renamed tasks need no migration
  constraint user_guide_state_shape check (
    jsonb_typeof(state) = 'object'
    and state - array['welcome', 'done', 'firstStepsHidden'] = '{}'::jsonb
    and (not state ? 'welcome' or jsonb_typeof(state -> 'welcome') = 'number')
    and (not state ? 'done' or jsonb_typeof(state -> 'done') = 'object')
    and (not state ? 'firstStepsHidden' or jsonb_typeof(state -> 'firstStepsHidden') = 'boolean')
    and not jsonb_path_exists(state, '$.done.* ? (@.type() != "string")')
  ),
  -- A few dozen tasks take about 2 KB: the limit only stops a client that writes anything in it
  constraint user_guide_state_size check (octet_length(state::text) <= 8192)
);

create trigger user_guide_state_updated_at
before update on public.user_guide_state
for each row execute function public.set_updated_at();

-- The app saves the whole state with an upsert, which writes `user_id` too: the policies keep it
-- the user's own.
grant select on public.user_guide_state to authenticated;
grant insert (user_id, state), update (user_id, state) on public.user_guide_state to authenticated;

alter table public.user_guide_state enable row level security;

create policy "Users read their own guide state"
on public.user_guide_state for select to authenticated
using (user_id = (select auth.uid()) and public.current_app_role() is not null);

create policy "Users save their own guide state"
on public.user_guide_state for insert to authenticated
with check (user_id = (select auth.uid()) and public.current_app_role() is not null);

create policy "Users change their own guide state"
on public.user_guide_state for update to authenticated
using (user_id = (select auth.uid()) and public.current_app_role() is not null)
with check (user_id = (select auth.uid()));
