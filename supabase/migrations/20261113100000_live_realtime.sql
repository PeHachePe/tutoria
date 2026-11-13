-- Step 4.1 · The teacher's live panel hears the attempts that change and the new process events
-- through Realtime. Realtime only sends the changes of the tables in its publication, and applies
-- the RLS of each subscriber: a teacher only receives those of their students (2.3).
alter publication supabase_realtime add table public.attempt, public.process_event;
