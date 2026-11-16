-- Security review · Who runs the functions of `public` (docs/PLAN.md §2.3, D-062): nobody without
-- signing in, and a signed-in user only those of this list. Postgres lets anybody execute a new
-- function, so every migration revokes it: this fails if one forgets, or grants one more.
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

select is_empty(
  $$ select p.oid::regprocedure from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and has_function_privilege('anon', p.oid, 'execute') $$,
  'an anonymous visitor cannot execute any function'
);

select set_eq(
  $$ select p.proname::text from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and has_function_privilege('authenticated', p.oid, 'execute') $$,
  array[
    -- Helpers of the policies and of the checks of the tables
    'current_app_role', 'is_admin', 'is_staff', 'teaches_group', 'teaches_student',
    'teaches_assignment', 'is_enrolled', 'is_assigned_to_me', 'is_assigned_by_others',
    'is_visible_assignment', 'can_open_assignment', 'can_read_attempt', 'can_record_event',
    'can_edit_exercise', 'is_started_assignment', 'is_started_block', 'is_browser_event',
    'is_valid_exercise_translations', 'is_valid_text_translations', 'are_valid_parameters',
    'is_valid_ai_provider',
    -- What the app calls
    'open_attempt', 'retry_attempt', 'submit_attempt', 'hidden_test_count', 'save_exercise',
    'exercise_student_counts', 'assignment_student_counts', 'create_block', 'assign_exercises',
    'reorder_blocks', 'reorder_assignments', 'move_assignment'
  ],
  'a signed-in user executes the helpers of the policies and the functions of the app, no other'
);

select * from finish();
rollback;
