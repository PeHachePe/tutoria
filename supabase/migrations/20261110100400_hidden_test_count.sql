-- Step 2.2 · How many hidden tests an exercise has (docs/PLAN.md §2.5). Students cannot read the
-- hidden tests (RLS), but the workspace tells them how many checks their code also has to pass.
-- Only the count: never their input or their expected output.

create function public.hidden_test_count(target_exercise_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_staff() or public.is_assigned_to_me(target_exercise_id)) then
    raise exception 'Exercise not found' using errcode = 'P0002';
  end if;
  return (
    select count(*)::integer from public.test
    where exercise_id = target_exercise_id and is_hidden
  );
end;
$$;

revoke execute on function public.hidden_test_count(uuid) from public, anon;
grant execute on function public.hidden_test_count(uuid) to authenticated;
