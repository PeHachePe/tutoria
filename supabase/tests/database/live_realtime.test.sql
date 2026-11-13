-- Steps 4.1 and 4.2 · Realtime publishes what the live panel and the detail of an attempt hear:
-- the attempts that change, the new process events and the new tutor interactions.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

select set_eq(
  $$ select tablename::text from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' $$,
  array['attempt', 'process_event', 'tutor_interaction'],
  'Realtime publishes attempt, process_event and tutor_interaction'
);

select * from finish();
rollback;
