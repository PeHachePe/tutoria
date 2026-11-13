-- Step 4.2 · The detail of an attempt shows what the student asks the tutor while it happens.
-- Realtime sends the new interactions with the RLS of each subscriber, as with `attempt` and
-- `process_event` (step 4.1): a teacher only receives those of their students (2.3).
alter publication supabase_realtime add table public.tutor_interaction;
